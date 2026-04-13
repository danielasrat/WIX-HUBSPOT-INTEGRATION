"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = __importDefault(require("./routes/auth"));
const mappings_1 = __importDefault(require("./routes/mappings"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.get("/", (req, res) => {
    res.send("API running");
});
app.use("/api/auth", auth_1.default);
app.use("/api", mappings_1.default);
app.use("/api/webhooks", webhooks_1.default);
app.use("/webhooks", webhooks_1.default);
app.use((error, _req, res, _next) => {
    console.error("Unhandled error", error);
    res.status(500).json({ error: "Internal server error" });
});
exports.default = app;
//# sourceMappingURL=app.js.map