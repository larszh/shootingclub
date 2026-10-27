-- AlterTable

-- AlterTable
ALTER TABLE `Membership` ADD COLUMN `feeAmountOverrideCents` INTEGER NULL,
    ADD COLUMN `feeCategoryId` VARCHAR(191) NULL,
    ADD COLUMN `memberNumber` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `city` VARCHAR(191) NULL,
    ADD COLUMN `street` VARCHAR(191) NULL,
    ADD COLUMN `zip` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `BillingProfile` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `payeeName` VARCHAR(191) NULL,
    `payeeStreet` VARCHAR(191) NULL,
    `payeeZip` VARCHAR(191) NULL,
    `payeeCity` VARCHAR(191) NULL,
    `iban` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CHF',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BillingProfile_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeCategory` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeeCategory_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeRun` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `invoicePrefix` VARCHAR(191) NOT NULL DEFAULT 'MB-',
    `dueDays` INTEGER NOT NULL DEFAULT 30,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FeeRun_tenantId_year_key`(`tenantId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NULL,
    `membershipId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `year` INTEGER NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `memberName` VARCHAR(191) NOT NULL,
    `memberEmail` VARCHAR(191) NULL,
    `memberAddress` VARCHAR(191) NULL,
    `categoryName` VARCHAR(191) NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CHF',
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `paidAt` DATETIME(3) NULL,
    `paymentNote` VARCHAR(191) NULL,
    `remindedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeeInvoice_tenantId_year_status_idx`(`tenantId`, `year`, `status`),
    INDEX `FeeInvoice_userId_idx`(`userId`),
    UNIQUE INDEX `FeeInvoice_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_feeCategoryId_fkey` FOREIGN KEY (`feeCategoryId`) REFERENCES `FeeCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillingProfile` ADD CONSTRAINT `BillingProfile_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeCategory` ADD CONSTRAINT `FeeCategory_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRun` ADD CONSTRAINT `FeeRun_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoice` ADD CONSTRAINT `FeeInvoice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoice` ADD CONSTRAINT `FeeInvoice_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `FeeRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoice` ADD CONSTRAINT `FeeInvoice_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoice` ADD CONSTRAINT `FeeInvoice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoice` ADD CONSTRAINT `FeeInvoice_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `FeeCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Zahlungsempfänger aus BookingSettings ins gemeinsame Rechnungsprofil übernehmen
INSERT INTO `BillingProfile` (`id`, `tenantId`, `payeeName`, `payeeStreet`, `payeeZip`, `payeeCity`, `iban`, `currency`, `updatedAt`)
SELECT CONCAT('bp_', `id`), `tenantId`, `payeeName`, `payeeStreet`, `payeeZip`, `payeeCity`, `iban`, `currency`, NOW(3)
FROM `BookingSettings`
WHERE `payeeName` IS NOT NULL OR `iban` IS NOT NULL;

ALTER TABLE `BookingSettings` DROP COLUMN `iban`,
    DROP COLUMN `payeeCity`,
    DROP COLUMN `payeeName`,
    DROP COLUMN `payeeStreet`,
    DROP COLUMN `payeeZip`;
