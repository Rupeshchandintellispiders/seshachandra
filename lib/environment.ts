import "./load-env";
import { storage } from "./storage";
export const env = { ...process.env, BUCKET: storage };
