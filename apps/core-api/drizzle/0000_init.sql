CREATE TABLE `class_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`days` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`transport` text NOT NULL,
	`brand` text,
	`model` text,
	`hw_ref` text,
	`sort` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`type` text NOT NULL,
	`actor` text,
	`public_id` text,
	`subject` text,
	`payload` text,
	`result` text
);
--> statement-breakpoint
CREATE INDEX `event_log_at_idx` ON `event_log` (`at`);--> statement-breakpoint
CREATE TABLE `ir_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`setpoint_temp_c` integer,
	`setpoint_mode` text,
	`setpoint_fan` text,
	`code_format` text NOT NULL,
	`code` text,
	`captured_at` text,
	`test` text NOT NULL,
	`tested_at` text,
	`sort` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ir_commands_device_idx` ON `ir_commands` (`device_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`access` text NOT NULL,
	`client_type` text NOT NULL,
	`label` text NOT NULL,
	`ip` text NOT NULL,
	`created_at` text NOT NULL,
	`unlocked_at` text,
	`last_activity` text,
	`expires_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_public_id_unique` ON `sessions` (`public_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `timed_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`time` text NOT NULL,
	`days` text NOT NULL,
	`enabled` integer NOT NULL,
	`steps` text NOT NULL
);
