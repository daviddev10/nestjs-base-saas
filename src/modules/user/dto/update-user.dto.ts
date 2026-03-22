import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserDto {
    @ApiPropertyOptional({
        enum: UserRole,
        example: UserRole.SECRETARY,
    })
    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;
}