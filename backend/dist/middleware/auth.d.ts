import { NextFunction, Request, Response } from "express";
export declare function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
export declare function requireWebhookSecret(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.d.ts.map