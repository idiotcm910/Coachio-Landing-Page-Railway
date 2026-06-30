import os
import uuid
import asyncio
from typing import Optional
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from app.core.config import settings
import aiohttp
from urllib.parse import urlparse


class S3StorageService:
    """Service for handling S3 storage operations"""

    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT or None,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION or None,
        )
        self.bucket_name = settings.S3_BUCKET_NAME

    def generate_object_key(self, file_extension: str = "") -> str:
        """Generate a unique object key for S3"""
        unique_id = str(uuid.uuid4())
        if file_extension:
            return f"generated/{unique_id}.{file_extension.lstrip('.')}"
        return f"generated/{unique_id}"

    async def upload_from_url(self, url: str, object_key: Optional[str] = None) -> str:
        """
        Download file from URL and upload to S3

        Args:
            url: URL to download file from
            object_key: Optional S3 object key. If not provided, will generate one

        Returns:
            S3 URL of the uploaded file

        Raises:
            Exception: If download or upload fails
        """
        if not object_key:
            # Extract file extension from URL
            parsed_url = urlparse(url)
            path = parsed_url.path
            file_extension = os.path.splitext(path)[1]
            object_key = self.generate_object_key(file_extension)

        try:
            # Download file from URL
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status != 200:
                        raise Exception(f"Failed to download file from URL: {url}")

                    # Get file content
                    file_content = await response.read()

                    # Upload to S3
                    upload_result = await asyncio.get_event_loop().run_in_executor(
                        None,
                        self._upload_to_s3,
                        file_content,
                        object_key
                    )

                    # Return S3 URL
                    return self._get_s3_url(object_key)

        except Exception as e:
            raise Exception(f"Failed to upload file from URL to S3: {str(e)}")

    def _upload_to_s3(self, file_content: bytes, object_key: str) -> dict:
        """Upload file content to S3 (synchronous for boto3)"""
        try:
            return self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_key,
                Body=file_content
            )
        except (BotoCoreError, ClientError) as e:
            raise Exception(f"S3 upload failed: {str(e)}")

    def _get_s3_url(self, object_key: str) -> str:
        """Generate S3 URL for an object"""
        # Use CDN URL if configured
        if settings.BUNNY_CDN_URL:
            # Ensure CDN URL doesn't end with trailing slash
            cdn_url = settings.BUNNY_CDN_URL.rstrip('/')
            return f"{cdn_url}/{object_key}"
        elif settings.S3_ENDPOINT:
            # For custom S3 endpoints
            return f"{settings.S3_ENDPOINT}/{self.bucket_name}/{object_key}"
        else:
            # For AWS S3
            return f"https://{self.bucket_name}.s3.{settings.S3_REGION}.amazonaws.com/{object_key}"

    async def upload_file(self, file_path_or_url: str, object_key: Optional[str] = None) -> str:
        """
        Upload a file (from local path or URL) to S3

        Args:
            file_path_or_url: Local file path or URL
            object_key: Optional S3 object key

        Returns:
            S3 URL of the uploaded file
        """
        if file_path_or_url.startswith(('http://', 'https://')):
            # Upload from URL
            return await self.upload_from_url(file_path_or_url, object_key)
        else:
            # Upload from local file
            if not object_key:
                file_extension = os.path.splitext(file_path_or_url)[1]
                object_key = self.generate_object_key(file_extension)

            try:
                with open(file_path_or_url, 'rb') as file:
                    file_content = file.read()

                await asyncio.get_event_loop().run_in_executor(
                    None,
                    self._upload_to_s3,
                    file_content,
                    object_key
                )

                return self._get_s3_url(object_key)

            except FileNotFoundError:
                raise Exception(f"Local file not found: {file_path_or_url}")
            except Exception as e:
                raise Exception(f"Failed to upload local file to S3: {str(e)}")

    def generate_presigned_url(self, object_key: str, expiration: int = 3600) -> Optional[str]:
        """
        Generate a presigned URL for S3 object

        Args:
            object_key: S3 object key
            expiration: URL expiration time in seconds (default: 1 hour)

        Returns:
            Presigned URL or None if failed
        """
        try:
            return self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_key},
                ExpiresIn=expiration
            )
        except (BotoCoreError, ClientError):
            return None

    def _delete_from_s3(self, object_key: str) -> None:
        """Delete an object from S3 (synchronous for boto3).

        boto3 delete_object is idempotent — it does NOT raise if the key is
        absent. We only raise on real errors (auth, network, bucket missing).
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_key)
        except (BotoCoreError, ClientError) as e:
            raise Exception(f"S3 delete failed: {str(e)}")

    async def delete_object(self, object_key: str) -> None:
        """Delete an object from S3 by its object key.

        Raises on a real failure so callers don't report a false success.
        """
        await asyncio.get_event_loop().run_in_executor(
            None,
            self._delete_from_s3,
            object_key,
        )

    async def upload_file_from_bytes(self, file_content: bytes, object_key: str) -> str:
        """
        Upload file from bytes directly to S3

        Args:
            file_content: File content as bytes
            object_key: S3 object key (full path)

        Returns:
            S3 CDN URL of the uploaded file

        Raises:
            Exception: If upload fails
        """
        try:
            # Upload to S3
            await asyncio.get_event_loop().run_in_executor(
                None,
                self._upload_to_s3,
                file_content,
                object_key
            )

            # Return CDN URL
            return self._get_s3_url(object_key)

        except Exception as e:
            raise Exception(f"Failed to upload file to S3: {str(e)}")


# Create a singleton instance
storage_service = S3StorageService()