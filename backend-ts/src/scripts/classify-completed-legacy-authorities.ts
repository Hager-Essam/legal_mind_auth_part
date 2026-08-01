import { normalizeLawName } from "../modules/legal-corpus/arabic-normalize";
import { MongoService, ragConnection } from "../infrastructure/mongo/mongo.service";
import { isDryRun } from "./script-utils";

type Classification = { filter: Record<string, unknown>; fields: Record<string, unknown>; basis: string };
const reviewedAt = new Date("2026-07-31T00:00:00.000Z");
const common = (fields: Record<string, unknown>, basis: string): Record<string, unknown> => ({ ...fields, authorityTitleNormalized: normalizeLawName(String(fields.authorityTitleOfficial ?? "")), reviewedBy: "targeted-legacy-authority-review", reviewedAt, verificationMethod: basis });
const decisions: Classification[] = [
 ["74b4c16e12ffa1b663ebd792cdfe25fc","eg-court-ruling-appeal-6-8-1965","محكمة النقض المصرية، الطعن رقم 6 لسنة 8 قضائية، جلسة 23-05-1965"],
 ["74c2b0f8aae07d28bd0c8e3f7d4ff73c","eg-court-ruling-appeal-1605-55-1985","محكمة النقض المصرية، الطعن رقم 1605 لسنة 55 قضائية، جلسة 02-10-1985"],
 ["74c5457fc43d4337635368d9e0d6fe8b","eg-court-ruling-appeal-203-1946","محكمة النقض المصرية، الطعن رقم 203، جلسة 18-03-1946"],
 ["74ebd16a494da90017b5472b2bda9b9b","eg-court-ruling-appeal-1720-48-1979","محكمة النقض المصرية، الطعن رقم 1720 لسنة 48 قضائية، جلسة 11-02-1979"],
 ["74f7e863598f4a973d888681429fda90","eg-court-ruling-appeal-6133-55-1986","محكمة النقض المصرية، الطعن رقم 6133 لسنة 55 قضائية، جلسة 13-01-1986"],
 ["ffafefc4df95da580bd46ceef5a0d112","eg-court-ruling-appeal-2-25-1956","محكمة النقض المصرية، الطعن رقم 2 لسنة 25 قضائية، جلسة 19-01-1956"],
].map(([chunkId,authorityId,title])=>({filter:{$or:[{chunk_id:chunkId},{parent_chunk_id:chunkId}]},fields:common({authorityId,authorityTitleOfficial:title,authorityType:"court_ruling",authorityStatus:"historical"},"Classified from stored appeal number, judicial year, and ruling date; historical marks a dated judicial decision, not invalidity."),basis:"stored court metadata"}));
const groups: Classification[] = [
 {filter:{authorityId:"legacy-6a92bc251bce0a60"},fields:common({authorityTitleOfficial:"قانون توجيه وتنظيم أعمال البناء رقم 106 لسنة 1976",authorityType:"statute",authorityStatus:"repealed",law_number:"106",law_year:"1976"},"Law 119/2008 repealed Law 106/1976 except Article 13 bis."),basis:"Law 119/2008 repeal clause"},
 {filter:{authorityId:"legacy-d016dd045184925b"},fields:common({authorityTitleOfficial:"قانون المرافعات المدنية والتجارية رقم 13 لسنة 1968",authorityType:"statute",authorityStatus:"amended",law_number:"13",law_year:"1968"},"Corrected OCR year 1986 to Law 13/1968; current law has subsequent amendments."),basis:"current amended procedure law"},
 {filter:{authorityId:"legacy-6ff7b273716ff417"},fields:common({authorityTitleOfficial:"قانون الرسوم القضائية ورسوم التوثيق في المواد المدنية رقم 90 لسنة 1944",authorityType:"statute",authorityStatus:"amended",law_number:"90",law_year:"1944"},"Classified as the judicial-fees statute still cited with subsequent amendments."),basis:"judicial fees law classification"},
 {filter:{authorityId:"legacy-36e3798d208b2543"},fields:common({authorityTitleOfficial:"اللائحة الداخلية لمجلس الشورى المصري",authorityType:"regulation",authorityStatus:"historical"},"Historical regulation of the former Shura Council."),basis:"former Shura Council regulation"},
 {filter:{authorityId:"legacy-e7509b0c6f3ed1f4"},fields:common({authorityTitleOfficial:"اللائحة التنفيذية لقانون ضمانات وحوافز الاستثمار رقم 8 لسنة 1997",authorityType:"regulation",authorityStatus:"repealed",law_number:"8",law_year:"1997"},"Law 72/2017 repealed Investment Guarantees and Incentives Law 8/1997."),basis:"GAFI and Law 72/2017 repeal clause"},
 {filter:{authorityId:"legacy-26b8606620a60125"},fields:common({authorityTitleOfficial:"مجموعة الإيجارات والبيوع",authorityType:"secondary_source",authorityStatus:"historical"},"Mixed legal compilation containing statutes and rulings; it is not itself an official court ruling or statute."),basis:"stored mixed-compilation content"},
];
const run=async():Promise<void>=>{const dryRun=isDryRun()||!process.argv.includes("--apply");const mongo=new MongoService();await mongo.connect();try{const c=ragConnection.db!.collection("legal_chunks");const classifications=[...decisions,...groups];let matched=0,modified=0;const work=[];for(const item of classifications){const count=await c.countDocuments(item.filter);matched+=count;work.push({filter:item.filter,count,basis:item.basis,authorityType:item.fields.authorityType,authorityStatus:item.fields.authorityStatus});if(!dryRun){const result=await c.updateMany(item.filter,{$set:item.fields});modified+=result.modifiedCount;}}console.log(JSON.stringify({dryRun,database:ragConnection.db!.databaseName,collection:"legal_chunks",classifications:classifications.length,matched,modified,work},null,2));}finally{await mongo.close();}};
run().catch(error=>{console.error("classify legacy authorities failed: "+(error instanceof Error?error.message:"unknown error"));process.exitCode=1;});
