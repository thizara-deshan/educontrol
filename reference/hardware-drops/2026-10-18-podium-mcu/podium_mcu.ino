/*
 * Eduscope Central — podium peripheral MCU
 * ESP32-WROOM-32, USB serial to the Raspberry Pi as /dev/podium-mcu
 *
 * Core jobs:
 *   four X9C103S digipots, ganged into two stereo pairs
 *   the 2x1 HDMI switch — press through a PC817, confirm from its own LEDs
 *
 * Expansion block, for whatever comes next:
 *   RS232 via MAX3232   projector control, serial displays
 *   SPI master          sensors, displays, ADCs
 *   two GPIO            input or output, with change events
 *
 * IR is NOT here. It lives on the Zigbee blaster.
 *
 * PIN MAP
 *   32  INC    shared by all four digipots
 *   33  U/D    shared by all four digipots
 *   25  CS A   U3 + U4 tied together   (PC stereo)
 *   26  CS B   U5 + U6 tied together   (Mic stereo)
 *   13  HDMI switch button -> 220R -> PC817
 *   34  HDMI status LED 1  ADC1_CH6, input only, analogRead ONLY
 *   35  HDMI status LED 2  ADC1_CH7, input only, analogRead ONLY
 *   16  RS232 RX   Serial2 -> MAX3232
 *   17  RS232 TX   Serial2 -> MAX3232
 *   23  SPI MOSI       19  SPI MISO
 *   18  SPI SCK         5  SPI CS   (strap, idles high — correct for CS)
 *    4  AUX GPIO 1     21  AUX GPIO 2
 *   22  status LED
 *   0, 2, 6-11, 12, 15 never used: boot straps and flash
 *
 * PROTOCOL  115200 8N1, one command per line.
 *   Every command answers exactly one line: "ok" or "err <reason>".
 *   Any data lines come BEFORE that. Lines beginning "evt " are unsolicited
 *   and may arrive at any moment, including between a command and its reply.
 *   The host must keep the two streams apart.
 *
 *   Send "help" for the full command list.
 */

#include <Preferences.h>
#include <SPI.h>
#include <math.h>

// ------------------------------------------------------------------ pins
static const uint8_t PIN_INC      = 32;
static const uint8_t PIN_UD       = 33;
static const uint8_t PIN_CS_A     = 25;
static const uint8_t PIN_CS_B     = 26;
static const uint8_t PIN_OPTO     = 13;
static const uint8_t PIN_LED1     = 34;
static const uint8_t PIN_LED2     = 35;
static const uint8_t PIN_STAT     = 22;
static const uint8_t PIN_AUX1     = 4;
static const uint8_t PIN_AUX2     = 21;
static const uint8_t PIN_RS_RX    = 16;
static const uint8_t PIN_RS_TX    = 17;
static const uint8_t PIN_SPI_MOSI = 23;
static const uint8_t PIN_SPI_MISO = 19;
static const uint8_t PIN_SPI_SCK  = 18;
static const uint8_t PIN_SPI_CS   = 5;

static const char *FW = "eduscope-podium-mcu 2.1";

Preferences prefs;

// -------------------------------------------------------------- settings
struct Settings {
  int      thr1      = 800;      // ADC counts, LED 1 lit/unlit boundary
  int      thr2      = 800;      // same for LED 2
  bool     litIsHigh = true;     // true: lit reads ABOVE the threshold
  float    taper     = 2.5f;     // volume curve exponent, 1.0 = linear
  uint32_t rsBaud    = 9600;     // RS232
  uint8_t  rsEol     = 1;        // 0 none, 1 CR, 2 LF, 3 CRLF
  uint32_t spiHz     = 1000000;
  uint8_t  spiMode   = 0;        // 0..3
} cfg;

// ----------------------------------------------------------------- state
static int      tapA = -1, tapB = -1;    // -1 = not homed since boot
static int      lastSrc = 0;             // 0 unknown, else 1 or 2
static uint32_t lastCmdMs = 0;
static bool     hostSilent = false;
static bool     spiReady = false;
static bool     spiHold  = false;        // CS held low across transfers

// AUX pin modes: 0 output, 1 input float, 2 input pullup, 3 input pulldown
struct Aux { uint8_t pin; uint8_t mode; int last; };
static Aux aux[2] = { { PIN_AUX1, 0, -1 }, { PIN_AUX2, 0, -1 } };

// ========================================================== small helpers

// Blocking wait that still feeds the scheduler, so a long switch sequence
// never trips the task watchdog.
static void holdFor(uint32_t ms) {
  uint32_t end = millis() + ms;
  while ((int32_t)(end - millis()) > 0) { delay(5); yield(); }
}

static void evt(const String &s) { Serial.print("evt "); Serial.println(s); }
static void ok()                 { Serial.println("ok"); }
static void err(const char *why) { Serial.print("err "); Serial.println(why); }

static int hexVal(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

// Returns byte count, or -1 on a bad character or an odd nibble.
static int parseHex(const String &s, uint8_t *out, int maxLen) {
  int n = 0, i = 0, len = s.length();
  while (i < len && n < maxLen) {
    while (i < len && s[i] == ' ') i++;
    if (i >= len) break;
    if (i + 1 >= len) return -1;
    int hi = hexVal(s[i]), lo = hexVal(s[i + 1]);
    if (hi < 0 || lo < 0) return -1;
    out[n++] = (uint8_t)((hi << 4) | lo);
    i += 2;
  }
  return n;
}

static String toHex(const uint8_t *b, int n) {
  static const char *H = "0123456789ABCDEF";
  String s;
  s.reserve(n * 2);
  for (int i = 0; i < n; i++) { s += H[b[i] >> 4]; s += H[b[i] & 0x0F]; }
  return s;
}

// ========================================================= X9C103S driver
//
// Three datasheet rules that matter:
//   the wiper steps on each FALLING edge of INC while CS is low
//   CS rising while INC is HIGH  -> position written to EEPROM
//   CS rising while INC is LOW   -> position changed, NOT stored
//
// Every ordinary move must therefore end with INC low. Get it backwards and
// you burn one of the part's 100k EEPROM writes on every single step.

static void x9cMove(uint8_t csPin, bool up, int steps) {
  if (steps <= 0) return;
  digitalWrite(PIN_UD, up ? HIGH : LOW);
  delayMicroseconds(5);                   // t_DI, 2.9 us min
  digitalWrite(PIN_INC, HIGH);
  digitalWrite(csPin, LOW);
  delayMicroseconds(5);                   // t_CI
  for (int i = 0; i < steps; i++) {
    digitalWrite(PIN_INC, LOW);
    delayMicroseconds(3);                 // t_IL, 1 us min
    digitalWrite(PIN_INC, HIGH);
    delayMicroseconds(3);                 // t_IH, 1 us min
  }
  digitalWrite(PIN_INC, LOW);             // low on the CS rise = no store
  delayMicroseconds(2);
  digitalWrite(csPin, HIGH);
  delayMicroseconds(5);
  digitalWrite(PIN_INC, HIGH);
}

static void x9cStore(uint8_t csPin) {
  digitalWrite(PIN_INC, HIGH);
  digitalWrite(csPin, LOW);
  delayMicroseconds(5);
  digitalWrite(csPin, HIGH);              // high on the CS rise = store
  delay(20);                              // t_WR, 10 ms typical
}

// No readback exists, so after a reset we cannot know where the wiper sits.
// Sweep past the bottom once; it parks at tap 0 and we count from there.
static void x9cHome(uint8_t csPin) { x9cMove(csPin, false, 110); }

static uint8_t csFor(char ch)   { ch |= 0x20; return (ch == 'a') ? PIN_CS_A : PIN_CS_B; }
static int    *tapFor(char ch)  { ch |= 0x20; return (ch == 'a') ? &tapA : &tapB; }
static bool    validCh(char ch) { ch |= 0x20; return ch == 'a' || ch == 'b'; }

static void setTap(char ch, int want) {
  want = constrain(want, 0, 99);
  uint8_t cs  = csFor(ch);
  int    *cur = tapFor(ch);
  if (*cur < 0) { x9cHome(cs); *cur = 0; }
  int delta = want - *cur;
  if (delta > 0)      x9cMove(cs, true,  delta);
  else if (delta < 0) x9cMove(cs, false, -delta);
  *cur = want;
}

// Ears are logarithmic, the X9C taper is linear. Without this the bottom
// half of the slider does nothing audible and the top few steps do it all.
static int volToTap(int vol) {
  vol = constrain(vol, 0, 100);
  if (vol == 0)   return 0;
  if (vol >= 100) return 99;
  return constrain((int)lroundf(powf(vol / 100.0f, cfg.taper) * 99.0f), 0, 99);
}

static int tapToVol(int tap) {
  if (tap <= 0) return 0;
  return constrain((int)lroundf(powf(tap / 99.0f, 1.0f / cfg.taper) * 100.0f), 0, 100);
}

// ======================================================= HDMI switch LEDs

static int readLed(uint8_t pin) {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogRead(pin); delayMicroseconds(200); }
  return (int)(sum / 16);
}

static bool lit(int raw, int thr) { return cfg.litIsHigh ? (raw > thr) : (raw < thr); }

// 1 or 2, or 0 when the two LEDs do not agree on any valid state.
static int readSource() {
  bool l1 = lit(readLed(PIN_LED1), cfg.thr1);
  bool l2 = lit(readLed(PIN_LED2), cfg.thr2);
  if (l1 && !l2) return 1;
  if (!l1 && l2) return 2;
  return 0;
}

static void pressButton() {
  digitalWrite(PIN_OPTO, HIGH);
  holdFor(120);
  digitalWrite(PIN_OPTO, LOW);
  holdFor(80);
}

// Press, look, press again. Never assume a press landed — a switch that
// missed one is the entire reason we read the LEDs back.
static bool setSource(int want) {
  for (int attempt = 0; attempt < 4; attempt++) {
    if (readSource() == want) return true;
    pressButton();
    holdFor(600);                         // switch relocks, LED settles
  }
  return readSource() == want;
}

// ======================================================== expansion block

static void rsApply() {
  Serial2.end();
  Serial2.begin(cfg.rsBaud, SERIAL_8N1, PIN_RS_RX, PIN_RS_TX);
}

static void rsSendEol() {
  switch (cfg.rsEol) {
    case 1: Serial2.write('\r'); break;
    case 2: Serial2.write('\n'); break;
    case 3: Serial2.write('\r'); Serial2.write('\n'); break;
    default: break;
  }
}

static void spiStart() {
  SPI.begin(PIN_SPI_SCK, PIN_SPI_MISO, PIN_SPI_MOSI, PIN_SPI_CS);
  pinMode(PIN_SPI_CS, OUTPUT);
  digitalWrite(PIN_SPI_CS, HIGH);
  spiReady = true;
  spiHold  = false;
}

static void spiXfer(uint8_t *buf, int n) {
  SPI.beginTransaction(SPISettings(cfg.spiHz, MSBFIRST, cfg.spiMode));
  if (!spiHold) digitalWrite(PIN_SPI_CS, LOW);
  for (int i = 0; i < n; i++) buf[i] = SPI.transfer(buf[i]);
  if (!spiHold) digitalWrite(PIN_SPI_CS, HIGH);
  SPI.endTransaction();
}

static void auxApply(int idx) {
  Aux &a = aux[idx];
  switch (a.mode) {
    case 0: pinMode(a.pin, OUTPUT); break;
    case 1: pinMode(a.pin, INPUT); break;
    case 2: pinMode(a.pin, INPUT_PULLUP); break;
    case 3: pinMode(a.pin, INPUT_PULLDOWN); break;
  }
  a.last = -1;                            // force a fresh event on next poll
}

// =============================================================== settings

static void loadSettings() {
  prefs.begin("podium", true);
  cfg.thr1      = prefs.getInt("thr1", cfg.thr1);
  cfg.thr2      = prefs.getInt("thr2", cfg.thr2);
  cfg.litIsHigh = prefs.getBool("pol", cfg.litIsHigh);
  cfg.taper     = prefs.getFloat("taper", cfg.taper);
  cfg.rsBaud    = prefs.getUInt("rsbaud", cfg.rsBaud);
  cfg.rsEol     = prefs.getUChar("rseol", cfg.rsEol);
  cfg.spiHz     = prefs.getUInt("spihz", cfg.spiHz);
  cfg.spiMode   = prefs.getUChar("spimode", cfg.spiMode);
  prefs.end();
}

static void saveSettings() {
  prefs.begin("podium", false);
  prefs.putInt("thr1", cfg.thr1);
  prefs.putInt("thr2", cfg.thr2);
  prefs.putBool("pol", cfg.litIsHigh);
  prefs.putFloat("taper", cfg.taper);
  prefs.putUInt("rsbaud", cfg.rsBaud);
  prefs.putUChar("rseol", cfg.rsEol);
  prefs.putUInt("spihz", cfg.spiHz);
  prefs.putUChar("spimode", cfg.spiMode);
  prefs.end();
}

// =============================================================== commands

static String arg(const String &s, int n) {
  int start = 0, idx = 0;
  while (idx < n) {
    int sp = s.indexOf(' ', start);
    if (sp < 0) return "";
    start = sp + 1;
    idx++;
  }
  int sp = s.indexOf(' ', start);
  return (sp < 0) ? s.substring(start) : s.substring(start, sp);
}

// Everything from word n onward, with the original spacing preserved.
static String rest(const String &s, int n) {
  int start = 0, idx = 0;
  while (idx < n) {
    int sp = s.indexOf(' ', start);
    if (sp < 0) return "";
    start = sp + 1;
    idx++;
  }
  return s.substring(start);
}

static void printHelp() {
  Serial.println("ping | ver | status | help");
  Serial.println("vol <a|b> <0-100> | vol <a|b> up|down [n] | vol? | volsave <a|b>");
  Serial.println("tap <a|b> <0-99>");
  Serial.println("src <1|2> | src? | cal | thresh <t1> <t2> | pol <0|1> | taper <1.0-4.0>");
  Serial.println("rs232 <text> | rs232hex <AABB> | rs232baud <n> | rs232eol <none|cr|lf|crlf>");
  Serial.println("spi init [hz] [mode] | spi <AABB> | spi hold <0|1> | spi?");
  Serial.println("gpio <1|2> out <0|1> | gpio <1|2> in [float|up|down] | gpio <1|2>?");
}

static void handle(String line) {
  line.trim();
  if (!line.length()) { ok(); return; }
  lastCmdMs = millis();
  if (hostSilent) { hostSilent = false; evt("host back"); }

  String cmd = arg(line, 0);
  cmd.toLowerCase();

  // ---- housekeeping ----------------------------------------------------
  if (cmd == "ping") { ok(); return; }
  if (cmd == "ver")  { Serial.println(FW); ok(); return; }
  if (cmd == "help") { printHelp(); ok(); return; }

  if (cmd == "status") {
    Serial.printf("gain a=%d tap=%d\n", tapA < 0 ? -1 : tapToVol(tapA), tapA);
    Serial.printf("gain b=%d tap=%d\n", tapB < 0 ? -1 : tapToVol(tapB), tapB);
    Serial.printf("src=%d\n", readSource());
    Serial.printf("led1=%d led2=%d\n", readLed(PIN_LED1), readLed(PIN_LED2));
    Serial.printf("thr1=%d thr2=%d pol=%d taper=%.2f\n",
                  cfg.thr1, cfg.thr2, cfg.litIsHigh ? 1 : 0, cfg.taper);
    Serial.printf("rs232 baud=%u eol=%u\n", cfg.rsBaud, cfg.rsEol);
    Serial.printf("spi ready=%d hz=%u mode=%u hold=%d\n",
                  spiReady ? 1 : 0, cfg.spiHz, cfg.spiMode, spiHold ? 1 : 0);
    for (int i = 0; i < 2; i++)
      Serial.printf("gpio%d mode=%u val=%d\n", i + 1, aux[i].mode,
                    aux[i].mode == 0 ? digitalRead(aux[i].pin) : digitalRead(aux[i].pin));
    ok();
    return;
  }

  // ---- gain ------------------------------------------------------------
  if (cmd == "vol" || cmd == "tap") {
    String chs = arg(line, 1), val = arg(line, 2);
    if (!chs.length() || !validCh(chs[0])) { err("bad_channel"); return; }
    char ch = chs[0];
    if (val == "up" || val == "down") {
      int *cur = tapFor(ch);
      if (*cur < 0) { err("not_homed"); return; }
      String nArg = arg(line, 3);
      int n = nArg.length() ? constrain(nArg.toInt(), 1, 99) : 1;
      setTap(ch, *cur + (val == "up" ? n : -n));
      ok();
      return;
    }
    if (!val.length()) { err("missing_value"); return; }
    setTap(ch, (cmd == "vol") ? volToTap(val.toInt()) : val.toInt());
    ok();
    return;
  }

  if (cmd == "vol?") {
    Serial.printf("a=%d\n", tapA < 0 ? -1 : tapToVol(tapA));
    Serial.printf("b=%d\n", tapB < 0 ? -1 : tapToVol(tapB));
    ok();
    return;
  }

  // 100k EEPROM writes rated. The host must debounce, never call per step.
  if (cmd == "volsave") {
    String chs = arg(line, 1);
    if (!chs.length() || !validCh(chs[0])) { err("bad_channel"); return; }
    if (*tapFor(chs[0]) < 0) { err("not_homed"); return; }
    x9cStore(csFor(chs[0]));
    ok();
    return;
  }

  // ---- HDMI source -----------------------------------------------------
  if (cmd == "src") {
    String val = arg(line, 1);
    if (!val.length()) { err("missing_value"); return; }
    int want = val.toInt();
    if (want != 1 && want != 2) { err("bad_source"); return; }
    bool good = setSource(want);
    lastSrc = readSource();
    Serial.printf("src=%d\n", lastSrc);
    if (good) ok(); else err("switch_did_not_confirm");
    return;
  }

  if (cmd == "src?") {
    lastSrc = readSource();
    Serial.printf("src=%d\n", lastSrc);
    ok();
    return;
  }

  // Run cal with the switch on each input in turn, note the two readings,
  // then set each threshold midway between them.
  if (cmd == "cal") {
    Serial.printf("led1=%d led2=%d\n", readLed(PIN_LED1), readLed(PIN_LED2));
    ok();
    return;
  }

  if (cmd == "thresh") {
    String a = arg(line, 1), b = arg(line, 2);
    if (!a.length() || !b.length()) { err("need_two_values"); return; }
    cfg.thr1 = constrain(a.toInt(), 0, 4095);
    cfg.thr2 = constrain(b.toInt(), 0, 4095);
    saveSettings(); ok(); return;
  }

  if (cmd == "pol") {
    String v = arg(line, 1);
    if (!v.length()) { err("missing_value"); return; }
    cfg.litIsHigh = (v.toInt() != 0);
    saveSettings(); ok(); return;
  }

  if (cmd == "taper") {
    String v = arg(line, 1);
    if (!v.length()) { err("missing_value"); return; }
    float t = v.toFloat();
    if (t < 1.0f || t > 4.0f) { err("out_of_range"); return; }
    cfg.taper = t;
    saveSettings(); ok(); return;
  }

  // ---- RS232 -----------------------------------------------------------
  if (cmd == "rs232") {
    String body = rest(line, 1);
    if (!body.length()) { err("missing_text"); return; }
    Serial2.print(body);
    rsSendEol();
    ok();
    return;
  }

  if (cmd == "rs232hex") {
    String body = rest(line, 1);
    if (!body.length()) { err("missing_bytes"); return; }
    uint8_t buf[128];
    int n = parseHex(body, buf, sizeof(buf));
    if (n < 0) { err("bad_hex"); return; }
    if (n == 0) { err("no_bytes"); return; }
    Serial2.write(buf, n);
    ok();
    return;
  }

  if (cmd == "rs232baud") {
    String v = arg(line, 1);
    if (!v.length()) { err("missing_value"); return; }
    uint32_t b = (uint32_t)v.toInt();
    if (b < 1200 || b > 460800) { err("out_of_range"); return; }
    cfg.rsBaud = b;
    rsApply();
    saveSettings(); ok(); return;
  }

  if (cmd == "rs232eol") {
    String v = arg(line, 1); v.toLowerCase();
    if      (v == "none") cfg.rsEol = 0;
    else if (v == "cr")   cfg.rsEol = 1;
    else if (v == "lf")   cfg.rsEol = 2;
    else if (v == "crlf") cfg.rsEol = 3;
    else { err("bad_eol"); return; }
    saveSettings(); ok(); return;
  }

  // ---- SPI -------------------------------------------------------------
  if (cmd == "spi") {
    String sub = arg(line, 1);
    String subl = sub; subl.toLowerCase();

    if (subl == "init") {
      String h = arg(line, 2), m = arg(line, 3);
      if (h.length()) {
        uint32_t hz = (uint32_t)h.toInt();
        if (hz < 1000 || hz > 20000000) { err("hz_out_of_range"); return; }
        cfg.spiHz = hz;
      }
      if (m.length()) {
        int md = m.toInt();
        if (md < 0 || md > 3) { err("bad_mode"); return; }
        cfg.spiMode = (uint8_t)md;
      }
      spiStart();
      saveSettings();
      ok();
      return;
    }

    if (subl == "hold") {
      if (!spiReady) { err("spi_not_init"); return; }
      String v = arg(line, 2);
      if (!v.length()) { err("missing_value"); return; }
      spiHold = (v.toInt() != 0);
      digitalWrite(PIN_SPI_CS, spiHold ? LOW : HIGH);
      ok();
      return;
    }

    // bare "spi <hex>" is a full-duplex transfer
    if (!spiReady) { err("spi_not_init"); return; }
    String body = rest(line, 1);
    if (!body.length()) { err("missing_bytes"); return; }
    uint8_t buf[128];
    int n = parseHex(body, buf, sizeof(buf));
    if (n < 0) { err("bad_hex"); return; }
    if (n == 0) { err("no_bytes"); return; }
    spiXfer(buf, n);
    Serial.print("rx ");
    Serial.println(toHex(buf, n));
    ok();
    return;
  }

  if (cmd == "spi?") {
    Serial.printf("ready=%d hz=%u mode=%u hold=%d\n",
                  spiReady ? 1 : 0, cfg.spiHz, cfg.spiMode, spiHold ? 1 : 0);
    ok();
    return;
  }

  // ---- AUX GPIO --------------------------------------------------------
  if (cmd == "gpio") {
    String ns = arg(line, 1);
    if (!ns.length()) { err("missing_pin"); return; }
    bool query = ns.endsWith("?");
    if (query) ns.remove(ns.length() - 1);
    int which = ns.toInt();
    if (which != 1 && which != 2) { err("bad_pin"); return; }
    Aux &a = aux[which - 1];

    if (query) {
      Serial.printf("gpio%d=%d mode=%u\n", which, digitalRead(a.pin), a.mode);
      ok();
      return;
    }

    String how = arg(line, 2); how.toLowerCase();

    if (how == "out") {
      String v = arg(line, 3);
      if (!v.length()) { err("missing_value"); return; }
      a.mode = 0;
      auxApply(which - 1);
      digitalWrite(a.pin, v.toInt() ? HIGH : LOW);
      ok();
      return;
    }

    if (how == "in") {
      String p = arg(line, 3); p.toLowerCase();
      if      (!p.length() || p == "float") a.mode = 1;
      else if (p == "up")                   a.mode = 2;
      else if (p == "down")                 a.mode = 3;
      else { err("bad_pull"); return; }
      auxApply(which - 1);
      ok();
      return;
    }

    err("bad_subcommand");
    return;
  }

  err("unknown_command");
}

// =================================================================== main

void setup() {
  pinMode(PIN_INC,  OUTPUT); digitalWrite(PIN_INC,  HIGH);
  pinMode(PIN_UD,   OUTPUT); digitalWrite(PIN_UD,   HIGH);
  pinMode(PIN_CS_A, OUTPUT); digitalWrite(PIN_CS_A, HIGH);   // CS idles high
  pinMode(PIN_CS_B, OUTPUT); digitalWrite(PIN_CS_B, HIGH);
  pinMode(PIN_OPTO, OUTPUT); digitalWrite(PIN_OPTO, LOW);
  pinMode(PIN_STAT, OUTPUT); digitalWrite(PIN_STAT, LOW);

  // GPIO 34 and 35 are input-only with no pull resistors. Nothing to
  // configure beyond the ADC range, and never call digitalRead on them.
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_LED1, ADC_11db);
  analogSetPinAttenuation(PIN_LED2, ADC_11db);

  Serial.begin(115200);

  loadSettings();
  rsApply();
  auxApply(0);
  auxApply(1);
  digitalWrite(PIN_AUX1, LOW);
  digitalWrite(PIN_AUX2, LOW);

  // SPI is NOT started here. Leaving GPIO 5 alone until asked keeps it in
  // its pulled-up strap state through boot, and nothing is attached yet.

  lastCmdMs = millis();

  // The digipots came back from their own EEPROM at whatever they held.
  // Do NOT touch them here: a sweep on every boot would be audible and
  // would wear the parts. The host homes them on its first level change.
  delay(50);
  evt("ready");
}

void loop() {
  static String buf, rsbuf;
  static uint32_t lastPoll = 0, lastAux = 0, lastBlink = 0;

  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (buf.length()) { handle(buf); buf = ""; }
    } else if (buf.length() < 320) {
      buf += c;
    }
  }

  // RS232 inbound becomes an unsolicited event, line by line.
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n' || c == '\r') {
      if (rsbuf.length()) { evt("rs232 " + rsbuf); rsbuf = ""; }
    } else if (rsbuf.length() < 200) {
      rsbuf += c;
    }
  }

  // Somebody pressed the HDMI switch by hand — tell the host rather than
  // let the panel show a stale source.
  if (millis() - lastPoll > 500) {
    lastPoll = millis();
    int now = readSource();
    if (now != 0 && now != lastSrc) {
      int was = lastSrc;
      lastSrc = now;
      evt("src changed " + String(was) + " " + String(now));
    }
  }

  // AUX pins configured as inputs report their own changes.
  if (millis() - lastAux > 50) {
    lastAux = millis();
    for (int i = 0; i < 2; i++) {
      if (aux[i].mode == 0) continue;
      int v = digitalRead(aux[i].pin);
      if (v != aux[i].last) {
        aux[i].last = v;
        evt("gpio " + String(i + 1) + " " + String(v));
      }
    }
  }

  // Host gone quiet. Report it and change nothing — yanking the projector
  // because a USB cable fell out would be worse than doing nothing.
  if (!hostSilent && millis() - lastCmdMs > 60000) {
    hostSilent = true;
    evt("fault host_silent");
  }

  uint32_t period = hostSilent ? 200 : 1000;
  if (millis() - lastBlink > period) {
    lastBlink = millis();
    digitalWrite(PIN_STAT, !digitalRead(PIN_STAT));
  }
}
