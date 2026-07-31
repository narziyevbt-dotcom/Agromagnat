import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import sharp, { type Metadata, type Sharp } from 'sharp';
import type { S3Config } from '../../config/configuration';

/** Long edge of a stored listing photo. */
export const PHOTO_MAX_EDGE = 1280;

/** Long edge of the feed thumbnail. */
export const THUMB_MAX_EDGE = 400;

/** Upload ceiling before resizing. */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export interface StoredImage {
  objectKey: string;
  url: string;
  thumbKey: string;
  thumbUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * S3-compatible object storage (MinIO in dev).
 *
 * Photos arrive straight from a phone camera at several megabytes each, over a
 * connection that is often 3G. Everything is re-encoded to WebP and capped at
 * 1280px before it is stored, and a small thumbnail is written alongside so the
 * feed never downloads full-size images.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage');
  private readonly client: S3Client;
  private readonly settings: S3Config;

  constructor(private readonly config: ConfigService) {
    this.settings = this.config.getOrThrow<S3Config>('s3');
    this.client = new S3Client({
      endpoint: this.settings.endpoint,
      region: this.settings.region,
      credentials: {
        accessKeyId: this.settings.accessKey,
        secretAccessKey: this.settings.secretKey,
      },
      // MinIO serves buckets as a path segment rather than a subdomain.
      forcePathStyle: true,
    });
  }

  /**
   * Validates, resizes and stores one image, returning both URLs.
   *
   * The MIME type is taken from the decoded pixels, not the client-supplied
   * header — an attacker can label anything `image/jpeg`, but sharp only
   * decodes what is genuinely an image.
   */
  async storeListingPhoto(
    listingId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<StoredImage> {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException("Rasm hajmi 12 MB dan oshmasligi kerak");
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Faqat JPG, PNG yoki WebP rasm yuklash mumkin');
    }

    let pipeline: Sharp;
    let metadata: Metadata;
    try {
      pipeline = sharp(file.buffer, { failOn: 'error' });
      metadata = await pipeline.metadata();
    } catch {
      throw new BadRequestException("Rasmni o'qib bo'lmadi. Boshqa rasm tanlang");
    }

    if (!metadata.width || !metadata.height) {
      throw new BadRequestException("Rasmni o'qib bo'lmadi. Boshqa rasm tanlang");
    }

    const id = randomUUID();
    const objectKey = `listings/${listingId}/${id}.webp`;
    const thumbKey = `listings/${listingId}/${id}_thumb.webp`;

    const full = await sharp(file.buffer)
      .rotate() // honour EXIF orientation, otherwise phone photos arrive sideways
      .resize(PHOTO_MAX_EDGE, PHOTO_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const thumb = await sharp(file.buffer)
      .rotate()
      .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    await Promise.all([
      this.put(objectKey, full.data, 'image/webp'),
      this.put(thumbKey, thumb, 'image/webp'),
    ]);

    return {
      objectKey,
      url: this.publicUrl(objectKey),
      thumbKey,
      thumbUrl: this.publicUrl(thumbKey),
      width: full.info.width,
      height: full.info.height,
      sizeBytes: full.info.size,
    };
  }

  async remove(...objectKeys: string[]): Promise<void> {
    await Promise.all(
      objectKeys.map(async (Key) => {
        try {
          await this.client.send(
            new DeleteObjectCommand({ Bucket: this.settings.bucket, Key }),
          );
        } catch (error) {
          // A failed cleanup must not fail the user's delete — the object is
          // orphaned, which a lifecycle rule can sweep later.
          this.logger.warn(`Could not delete ${Key}: ${String(error)}`);
        }
      }),
    );
  }

  private async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.settings.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  private publicUrl(key: string): string {
    return `${this.settings.publicUrl.replace(/\/$/, '')}/${key}`;
  }
}
