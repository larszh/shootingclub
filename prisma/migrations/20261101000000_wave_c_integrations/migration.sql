-- AlterTable
ALTER TABLE `BillingProfile` ADD COLUMN `onlineFeeProvider` VARCHAR(191) NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `viaTenantId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `feeInvoiceId` VARCHAR(191) NULL,
    ADD COLUMN `tenantId` VARCHAR(191) NULL,
    MODIFY `bookingId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `embedToken` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AccountingSettings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `bankAccount` VARCHAR(191) NOT NULL DEFAULT '1020',
    `receivableAccount` VARCHAR(191) NOT NULL DEFAULT '1100',
    `feeAccount` VARCHAR(191) NOT NULL DEFAULT '3000',
    `bookingAccount` VARCHAR(191) NOT NULL DEFAULT '3400',
    `ammoAccount` VARCHAR(191) NOT NULL DEFAULT '3200',
    `workFeeAccount` VARCHAR(191) NOT NULL DEFAULT '3010',
    `feesExpenseAccount` VARCHAR(191) NOT NULL DEFAULT '6940',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AccountingSettings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourceShare` (
    `id` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `guestTenantId` VARCHAR(191) NOT NULL,
    `canBook` BOOLEAN NOT NULL DEFAULT true,
    `priceFactorPercent` INTEGER NOT NULL DEFAULT 100,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ResourceShare_guestTenantId_idx`(`guestTenantId`),
    UNIQUE INDEX `ResourceShare_resourceId_guestTenantId_key`(`resourceId`, `guestTenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoreImport` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `format` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileHash` VARCHAR(191) NOT NULL,
    `rows` INTEGER NOT NULL DEFAULT 0,
    `matchIds` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ScoreImport_tenantId_fileHash_key`(`tenantId`, `fileHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Payment_feeInvoiceId_idx` ON `Payment`(`feeInvoiceId`);

-- CreateIndex
CREATE UNIQUE INDEX `Tenant_embedToken_key` ON `Tenant`(`embedToken`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_feeInvoiceId_fkey` FOREIGN KEY (`feeInvoiceId`) REFERENCES `FeeInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountingSettings` ADD CONSTRAINT `AccountingSettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceShare` ADD CONSTRAINT `ResourceShare_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `Resource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceShare` ADD CONSTRAINT `ResourceShare_guestTenantId_fkey` FOREIGN KEY (`guestTenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoreImport` ADD CONSTRAINT `ScoreImport_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

