import { copyDocuments, distDocumentsDir } from "./dashboard-lib.mjs";

const allowFlag = process.argv.includes("--allow");
if (!allowFlag && process.env.MEDS_ALLOW_DIST_DOCUMENTS !== "1" && process.env.MEDS_ALLOW_DIST_DOCUMENTS !== "true") {
  console.error(
    "Refusing to copy raw medical documents into dist. Set MEDS_ALLOW_DIST_DOCUMENTS=1 only for private/local builds.",
  );
  process.exit(1);
}

const count = await copyDocuments(distDocumentsDir);
console.log(`Copied ${count} documents to dist/files/documents.`);
