import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../app.module';
import { ColorCode, ColorCodeDocument } from '../modules/catalog/schemas/color-code.schema';
import { ProductType, ProductTypeDocument } from '../modules/catalog/schemas/product-type.schema';
import { DisplayBase, DisplayBaseDocument } from '../modules/catalog/schemas/display-base.schema';
import { User, UserDocument } from '../modules/users/schemas/user.schema';
import { BusinessConfig, BusinessConfigDocument } from '../modules/business-config/schemas/business-config.schema';
import { Role } from '../common/constants/roles';
import { DISPLAY_BASE_LIST, LIST_COLOR, PRODUCT_LIST } from './seed-data';

const log = new Logger('Seed');

/** Internal demo accounts. Change the passwords before real use. */
const PASSWORD_DEFAULT = 'Petmory@2026';

/*
 * Hai tai khoan noi bo, dung hai nhom quyen.
 *
 * Nhom Quan ly lo toan bo phan van hanh. Nhom Quan tri vien chi quan ly tai
 * khoan, nen tai khoan do khong mo duoc don hang hay bao cao.
 */
const ACCOUNT_INTERNAL: { email: string; fullName: string; roles: Role[] }[] = [
  {
    email: 'quanly@petmory.local',
    fullName: 'Quan ly PETMORY',
    roles: [Role.MANAGER],
  },
  {
    email: 'quantri@petmory.local',
    fullName: 'Quan tri tai khoan',
    roles: [Role.ADMIN],
  },
];

async function loadColor(model: Model<ColorCodeDocument>): Promise<void> {
  let count = 0;
  for (const [index, color] of LIST_COLOR.entries()) {
    await model.updateOne(
      { code: color.code },
      { $set: { ...color, sortOrder: index, enabled: true } },
      { upsert: true },
    );
    count += 1;
  }
  log.log(`Loaded ${count} wool colour codes`);
}

async function loadDisplayBase(model: Model<DisplayBaseDocument>): Promise<void> {
  for (const base of DISPLAY_BASE_LIST) {
    await model.updateOne(
      { code: base.code },
      {
        $set: {
          displayName: base.displayName,
          description: base.description,
          priceDelta: Types.Decimal128.fromString(base.priceDelta),
          currency: 'VND',
          sortOrder: base.sortOrder,
          enabled: true,
        },
      },
      { upsert: true },
    );
  }
  log.log(`Loaded ${DISPLAY_BASE_LIST.length} display bases`);
}

/**
 * Where the demo picture of a product type lives.
 *
 * Built from the account name in the environment rather than written out, so
 * moving to another account needs no change here. With no picture service set
 * up it falls back to the copy bundled with the web application, which keeps
 * the screens looking right on a machine that has no credentials.
 */
function pictureOf(code: string): string {
  const account = process.env.CLOUDINARY_CLOUD_NAME;
  const name = code.toLowerCase();
  if (process.env.STORAGE_DRIVER === 'cloudinary' && account) {
    return `https://res.cloudinary.com/${account}/image/upload/petmory/demo/${name}.png`;
  }
  return `/demo/${name}.png`;
}

async function loadProduct(model: Model<ProductTypeDocument>): Promise<void> {
  for (const kind of PRODUCT_LIST) {
    const sizes = kind.sizes.map((size) => ({
      ...size,
      price: Types.Decimal128.fromString(size.price),
      currency: 'VND',
      imageUrl: '',
      enabled: true,
    }));
    await model.updateOne(
      { code: kind.code },
      {
        $set: {
          name: kind.name,
          description: kind.description,
          material: kind.material,
          sortOrder: kind.sortOrder,
          imageUrl: pictureOf(kind.code),
          enabled: true,
          sizes,
        },
      },
      { upsert: true },
    );
  }
  const sizeCount = PRODUCT_LIST.reduce((total, kind) => total + kind.sizes.length, 0);
  log.log(`Loaded ${PRODUCT_LIST.length} product types with ${sizeCount} sizes`);
}

async function loadAccountInternal(model: Model<UserDocument>): Promise<void> {
  let created = 0;
  for (const tk of ACCOUNT_INTERNAL) {
    if (await model.exists({ email: tk.email })) {
      continue;
    }
    await model.create({
      email: tk.email,
      fullName: tk.fullName,
      passwordHash: await bcrypt.hash(PASSWORD_DEFAULT, 12),
      roles: tk.roles,
    });
    created += 1;
  }
  if (created > 0) {
    log.warn(`Created ${created} internal accounts with the default password. Change them now.`);
  } else {
    log.log('Internal accounts already exist, skipped');
  }
}

async function loadConfig(model: Model<BusinessConfigDocument>): Promise<void> {
  await model.updateOne({ key: 'DEFAULT' }, { $setOnInsert: {} }, { upsert: true });
  log.log('Business settings record is in place');
}

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  try {
    await loadColor(app.get<Model<ColorCodeDocument>>(getModelToken(ColorCode.name)));
    await loadDisplayBase(app.get<Model<DisplayBaseDocument>>(getModelToken(DisplayBase.name)));
    await loadProduct(app.get<Model<ProductTypeDocument>>(getModelToken(ProductType.name)));
    await loadAccountInternal(app.get<Model<UserDocument>>(getModelToken(User.name)));
    await loadConfig(app.get<Model<BusinessConfigDocument>>(getModelToken(BusinessConfig.name)));
    log.log('Seeding complete');
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  log.error('Seeding failed', error as Error);
  process.exit(1);
});
