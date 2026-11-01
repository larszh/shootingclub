-- AlterTable
ALTER TABLE `AccountingSettings` ADD COLUMN `cashAccount` VARCHAR(191) NOT NULL DEFAULT '1000',
    ADD COLUMN `kioskAccount` VARCHAR(191) NOT NULL DEFAULT '3600';

-- AlterTable
ALTER TABLE `AmmoOrder` ADD COLUMN `cancelledAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `refundedAt` DATETIME(3) NULL,
    ADD COLUMN `reminderSentAt` DATETIME(3) NULL,
    ADD COLUMN `seriesId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ClubWeapon` ADD COLUMN `blockReason` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `FeeInvoice` ADD COLUMN `cancelledAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Invoice` ADD COLUMN `cancelledAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `joinApproval` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `WorkHoursSettings` ADD COLUMN `proRata` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `BookingSeries` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `weekdays` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `fromDate` DATE NOT NULL,
    `untilDate` DATE NOT NULL,
    `persons` INTEGER NOT NULL DEFAULT 1,
    `note` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BookingSeries_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `BookingSeries_resourceId_idx`(`resourceId`),
    INDEX `BookingSeries_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeInvoiceMember` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `membershipId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeeInvoiceMember_membershipId_idx`(`membershipId`),
    INDEX `FeeInvoiceMember_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `FeeInvoiceMember_invoiceId_membershipId_key`(`invoiceId`, `membershipId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AwardLimit` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `programId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `minScore` DOUBLE NOT NULL,
    `award` VARCHAR(191) NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AwardLimit_tenantId_programId_year_idx`(`tenantId`, `programId`, `year`),
    INDEX `AwardLimit_programId_idx`(`programId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeaponSettings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `minorReportDays` INTEGER NOT NULL DEFAULT 30,
    `serviceEveryShotsDefault` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WeaponSettings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Association` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(8) NOT NULL,
    `region` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Association_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssociationMember` (
    `id` VARCHAR(191) NOT NULL,
    `associationId` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `shareNames` BOOLEAN NOT NULL DEFAULT false,
    `consentAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssociationMember_tenantId_idx`(`tenantId`),
    UNIQUE INDEX `AssociationMember_associationId_tenantId_key`(`associationId`, `tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssociationAdmin` (
    `id` VARCHAR(191) NOT NULL,
    `associationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'ADMIN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssociationAdmin_userId_idx`(`userId`),
    UNIQUE INDEX `AssociationAdmin_associationId_userId_key`(`associationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Booking_seriesId_idx` ON `Booking`(`seriesId`);

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_seriesId_fkey` FOREIGN KEY (`seriesId`) REFERENCES `BookingSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingSeries` ADD CONSTRAINT `BookingSeries_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingSeries` ADD CONSTRAINT `BookingSeries_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `Resource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingSeries` ADD CONSTRAINT `BookingSeries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoiceMember` ADD CONSTRAINT `FeeInvoiceMember_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `FeeInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoiceMember` ADD CONSTRAINT `FeeInvoiceMember_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeInvoiceMember` ADD CONSTRAINT `FeeInvoiceMember_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AwardLimit` ADD CONSTRAINT `AwardLimit_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AwardLimit` ADD CONSTRAINT `AwardLimit_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeaponSettings` ADD CONSTRAINT `WeaponSettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssociationMember` ADD CONSTRAINT `AssociationMember_associationId_fkey` FOREIGN KEY (`associationId`) REFERENCES `Association`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssociationMember` ADD CONSTRAINT `AssociationMember_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssociationAdmin` ADD CONSTRAINT `AssociationAdmin_associationId_fkey` FOREIGN KEY (`associationId`) REFERENCES `Association`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssociationAdmin` ADD CONSTRAINT `AssociationAdmin_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: Storno-/Rückerstattungszeitpunkte für bestehende Zeilen
UPDATE `FeeInvoice` SET `cancelledAt` = `updatedAt` WHERE `status` = 'CANCELLED' AND `cancelledAt` IS NULL;
UPDATE `AmmoOrder` SET `cancelledAt` = `updatedAt` WHERE `status` = 'CANCELLED' AND `cancelledAt` IS NULL;
UPDATE `Booking` SET `cancelledAt` = `updatedAt` WHERE `status` = 'CANCELLED' AND `cancelledAt` IS NULL;
UPDATE `Booking` SET `refundedAt` = `updatedAt` WHERE `paymentStatus` = 'REFUNDED' AND `refundedAt` IS NULL;
-- Invoice hat kein updatedAt: Stornozeit der Reservation, sonst Rechnungsdatum
UPDATE `Invoice` i JOIN `Booking` b ON b.`id` = i.`bookingId`
  SET i.`cancelledAt` = COALESCE(b.`cancelledAt`, b.`updatedAt`, i.`issuedAt`)
  WHERE i.`status` = 'CANCELLED' AND i.`cancelledAt` IS NULL;
