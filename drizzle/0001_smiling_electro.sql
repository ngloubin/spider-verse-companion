CREATE TABLE `ev_conversation_turns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ev_conversation_turns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ev_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`status` enum('pending_confirmation','connected','disabled') NOT NULL DEFAULT 'pending_confirmation',
	`capabilities` text,
	`secretRef` varchar(180),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ev_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ev_memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`memoryType` enum('important_fact','learned_context','system_note') NOT NULL,
	`content` text NOT NULL,
	`source` varchar(80) NOT NULL DEFAULT 'conversation',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ev_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ev_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`preferenceKey` varchar(80) NOT NULL,
	`preferenceValue` varchar(255) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ev_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `ev_preferences_user_key` UNIQUE(`userId`,`preferenceKey`)
);
