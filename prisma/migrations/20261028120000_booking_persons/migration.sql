-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `isFlatRate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `persons` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `units` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `BookingSettings` ADD COLUMN `capacityPerPerson` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `flatExclusive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `maxPersons` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `personPricing` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Resource` ADD COLUMN `maxPersons` INTEGER NULL;

