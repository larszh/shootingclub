-- AlterTable
ALTER TABLE `AwardLimit` ADD COLUMN `weaponCategory` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `MatchParticipant` ADD COLUMN `weaponCategory` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TranslationOverride` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL DEFAULT 'global',
    `locale` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TranslationOverride_scope_locale_key_key`(`scope`, `locale`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlatformAiSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'global',
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `allowClubs` BOOLEAN NOT NULL DEFAULT false,
    `apiKeyEnc` TEXT NULL,
    `keyHint` VARCHAR(191) NULL,
    `model` VARCHAR(191) NOT NULL DEFAULT 'claude-opus-5-5',
    `features` VARCHAR(191) NOT NULL DEFAULT 'translations,support',
    `monthlyTokenLimit` INTEGER NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TenantAiSettings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `apiKeyEnc` TEXT NULL,
    `keyHint` VARCHAR(191) NULL,
    `model` VARCHAR(191) NOT NULL DEFAULT 'claude-opus-5-5',
    `features` VARCHAR(191) NOT NULL DEFAULT 'help',
    `memberAccess` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `monthlyTokenLimit` INTEGER NULL,
    `consentAt` DATETIME(3) NULL,
    `consentById` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TenantAiSettings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiUsage` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `feature` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `inputTokens` INTEGER NOT NULL,
    `outputTokens` INTEGER NOT NULL,
    `cacheReadTokens` INTEGER NOT NULL DEFAULT 0,
    `cacheWriteTokens` INTEGER NOT NULL DEFAULT 0,
    `ok` BOOLEAN NOT NULL,
    `errorCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiUsage_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `AiUsage_scope_createdAt_idx`(`scope`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentTranslation` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `sourceHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AUTO',
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContentTranslation_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `ContentTranslation_entityType_entityId_field_locale_key`(`entityType`, `entityId`, `field`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiCache` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `feature` VARCHAR(191) NOT NULL,
    `cacheKey` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiCache_tenantId_idx`(`tenantId`),
    INDEX `AiCache_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `AiCache_feature_cacheKey_key`(`feature`, `cacheKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TenantAiSettings` ADD CONSTRAINT `TenantAiSettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiUsage` ADD CONSTRAINT `AiUsage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentTranslation` ADD CONSTRAINT `ContentTranslation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiCache` ADD CONSTRAINT `AiCache_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

