import { UserRole } from "@prisma/client";

export interface ICreatedUser {
    id: string;
    email: string;
    role: UserRole;
    emailVerified: boolean;
    createdAt: Date;
}