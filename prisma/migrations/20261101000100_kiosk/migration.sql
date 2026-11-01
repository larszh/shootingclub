-- CreateTable
CREATE TABLE `KioskProduct` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `priceCents` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `KioskProduct_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KioskEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `guestName` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPriceCents` INTEGER NOT NULL,
    `totalCents` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `billedInvoiceId` VARCHAR(191) NULL,
    `paidCash` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KioskEntry_clientId_key`(`clientId`),
    INDEX `KioskEntry_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `KioskEntry_userId_billedInvoiceId_idx`(`userId`, `billedInvoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KioskProduct` ADD CONSTRAINT `KioskProduct_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KioskEntry` ADD CONSTRAINT `KioskEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KioskEntry` ADD CONSTRAINT `KioskEntry_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `KioskProduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

