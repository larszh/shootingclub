-- CreateTable
CREATE TABLE `BookingSettings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CHF',
    `slotStepMinutes` INTEGER NOT NULL DEFAULT 30,
    `durationOptionsJson` TEXT NOT NULL,
    `openingHoursJson` TEXT NOT NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT false,
    `allowInvoice` BOOLEAN NOT NULL DEFAULT true,
    `allowOnline` BOOLEAN NOT NULL DEFAULT false,
    `onlineProvider` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `lastMinuteDiscountPercent` INTEGER NOT NULL DEFAULT 0,
    `lastMinuteWindowHours` INTEGER NOT NULL DEFAULT 24,
    `minLeadMinutes` INTEGER NOT NULL DEFAULT 60,
    `maxAdvanceDays` INTEGER NOT NULL DEFAULT 60,
    `cancellationHours` INTEGER NOT NULL DEFAULT 24,
    `invoiceDueDays` INTEGER NOT NULL DEFAULT 30,
    `invoicePrefix` VARCHAR(191) NOT NULL DEFAULT 'R-',
    `payeeName` VARCHAR(191) NULL,
    `payeeStreet` VARCHAR(191) NULL,
    `payeeZip` VARCHAR(191) NULL,
    `payeeCity` VARCHAR(191) NULL,
    `iban` VARCHAR(191) NULL,
    `invoiceNote` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BookingSettings_tenantId_key`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resource` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'LANE',
    `capacity` INTEGER NOT NULL DEFAULT 1,
    `durationOptionsJson` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Resource_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResourceBlock` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ResourceBlock_tenantId_startsAt_idx`(`tenantId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'CONFIRMED',
    `paymentMethod` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `paymentStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_REQUIRED',
    `basePriceCents` INTEGER NOT NULL DEFAULT 0,
    `discountCents` INTEGER NOT NULL DEFAULT 0,
    `discountReason` VARCHAR(191) NULL,
    `totalCents` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'CHF',
    `note` VARCHAR(191) NULL,
    `adminNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,

    INDEX `Booking_tenantId_startsAt_idx`(`tenantId`, `startsAt`),
    INDEX `Booking_resourceId_startsAt_idx`(`resourceId`, `startsAt`),
    INDEX `Booking_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerRef` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `detailsJson` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_bookingId_idx`(`bookingId`),
    INDEX `Payment_providerRef_idx`(`providerRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentProviderConfig` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `credentialsEnc` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentProviderConfig_tenantId_provider_key`(`tenantId`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `amountCents` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `paidAt` DATETIME(3) NULL,

    UNIQUE INDEX `Invoice_bookingId_key`(`bookingId`),
    UNIQUE INDEX `Invoice_tenantId_number_key`(`tenantId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BookingSettings` ADD CONSTRAINT `BookingSettings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceBlock` ADD CONSTRAINT `ResourceBlock_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResourceBlock` ADD CONSTRAINT `ResourceBlock_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `Resource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `Resource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentProviderConfig` ADD CONSTRAINT `PaymentProviderConfig_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
