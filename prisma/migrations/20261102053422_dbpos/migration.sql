-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "restaurantName" TEXT NOT NULL,
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "serviceChargeBps" INTEGER NOT NULL DEFAULT 0,
    "discountApprovalBps" INTEGER NOT NULL DEFAULT 1000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);
