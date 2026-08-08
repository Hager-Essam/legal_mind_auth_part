import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import dotenv from 'dotenv';
import fs from 'fs';
import { Readable } from 'stream';

dotenv.config();

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

const getR2Config = (): R2Config => {
  return {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || 'legal-mind-contracts',
    publicUrl: process.env.R2_PUBLIC_URL,
  };
};

export class R2StorageService {
  private client: S3Client;
  private bucketName: string;
  private publicUrl?: string;

  constructor(customConfig?: R2Config) {
    const config = customConfig || getR2Config();
    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;

    // AWS SDK >= 3.729 defaults to flexible checksums that R2 rejects (AccessDenied).
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl;
  }

  async uploadFile(localFilePath: string, key: string, contentType?: string): Promise<string> {
    try {
      const fileStream = fs.createReadStream(localFilePath);
      const fileStats = fs.statSync(localFilePath);

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileStream,
          ContentType: contentType || this.getMimeType(localFilePath),
          ContentLength: fileStats.size,
        },
      });

      await upload.done();
      return this.getPublicUrl(key);
    } catch (error: any) {
      throw new Error(`Failed to upload file to R2: ${error.message}`);
    }
  }

  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.client.send(command);
      return this.getPublicUrl(key);
    } catch (error: any) {
      throw new Error(`Failed to upload buffer to R2: ${error.message}`);
    }
  }

  async uploadString(content: string, key: string, contentType: string = 'text/plain'): Promise<string> {
    const buffer = Buffer.from(content, 'utf-8');
    return this.uploadBuffer(buffer, key, contentType);
  }

  async downloadFile(key: string, localFilePath: string): Promise<void> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error('Empty response body from R2');
      }

      const stream = response.Body as Readable;
      const writeStream = fs.createWriteStream(localFilePath);

      return new Promise((resolve, reject) => {
        stream.pipe(writeStream);
        stream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error: any) {
      throw new Error(`Failed to download file from R2: ${error.message}`);
    }
  }

  async downloadBuffer(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error('Empty response body from R2');
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error: any) {
      throw new Error(`Failed to download buffer from R2: ${error.message}`);
    }
  }

  async downloadString(key: string): Promise<string> {
    const buffer = await this.downloadBuffer(key);
    return buffer.toString('utf-8');
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error: any) {
      throw new Error(`Failed to delete file from R2: ${error.message}`);
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || (error as any).$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new Error(`Failed to check file existence in R2: ${error.message}`);
    }
  }

  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error: any) {
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    const accountId = process.env.R2_ACCOUNT_ID || '';
    return `https://${this.bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
  }

  generateKey(jobId: string, filename: string, prefix?: string): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (prefix) {
      return `${prefix}/${jobId}/${timestamp}_${sanitizedFilename}`;
    }
    return `${jobId}/${timestamp}_${sanitizedFilename}`;
  }

  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
      md: 'text/markdown',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
      json: 'application/json',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

export const r2Storage = new R2StorageService();
export default r2Storage;
