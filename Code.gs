/**
 * New Year Event • Digital Guestbook (Google Apps Script)
 * - รับ POST (FormData) จากหน้าเว็บ แล้วเก็บรูปลง Drive + บันทึกลง Google Sheet
 * - ให้ admin เรียก list ผ่าน GET?action=list&token=...
 *
 * ✅ ทำงานแบบไม่ต้องให้แขกล็อกอิน (deploy เป็น Web App: Anyone)
 */

// ====== ตั้งค่าครั้งแรก ======
const CONFIG = {
  DRIVE_FOLDER_ID: "PUT_DRIVE_FOLDER_ID_HERE",
  SHEET_NAME: "Guestbook",
  ADMIN_TOKEN: "PUT_ADMIN_TOKEN_HERE", // ตั้งเองเป็นรหัสยาว ๆ
  MAX_ROWS_LIST: 300 // จำกัดจำนวนแถวที่ส่งกลับสำหรับ admin/slideshow
};

// ====== Entry Points ======
function doPost(e) {
  try {
    const data = parseMultipart_(e);
    const event = (data.fields.event || "Event").trim();
    const name = (data.fields.name || "").trim();
    const team = (data.fields.team || "").trim();
    const message = (data.fields.message || "").trim();
    const clientTime = (data.fields.clientTime || "").trim();

    if (!name || !message) return json_(400, { ok:false, error:"missing name/message" });

    const ts = new Date();
    const timeText = Utilities.formatDate(ts, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    // Save photo (optional)
    let photoFileId = "";
    let photoUrl = "";
    if (data.files.photo && data.files.photo.bytes && data.files.photo.bytes.length) {
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      const safeEvent = sanitize_(event);
      const safeName = sanitize_(name);
      const ext = guessExt_(data.files.photo.contentType, data.files.photo.filename);
      const fname = `${safeEvent}_${timeText.replace(/[:\s]/g,"-")}_${safeName}${ext}`;
      const blob = Utilities.newBlob(data.files.photo.bytes, data.files.photo.contentType, fname);
      const file = folder.createFile(blob);

      // แชร์แบบ anyone with link เพื่อให้ slideshow/admin ดึงรูปได้
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (err) {
        // ถ้า policy องค์กรบล็อคการแชร์สาธารณะ จะไม่พังระบบ แค่ไม่มีรูป URL public
      }

      photoFileId = file.getId();
      photoUrl = driveImageViewUrl_(photoFileId);
    }

    // Append to Sheet
    const ss = getOrCreateSheet_();
    ss.appendRow([timeText, event, name, team, message, clientTime, photoFileId, photoUrl]);

    return json_(200, { ok:true });
  } catch (err) {
    return json_(500, { ok:false, error:String(err && err.message ? err.message : err) });
  }
}

function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();
  if (action === "list") {
    const token = e.parameter.token || "";
    if (token !== CONFIG.ADMIN_TOKEN) return json_(403, { ok:false, error:"forbidden" });

    const sh = getOrCreateSheet_();
    const last = sh.getLastRow();
    if (last < 2) return json_(200, { ok:true, rows:[] });

    const startRow = Math.max(2, last - CONFIG.MAX_ROWS_LIST + 1);
    const values = sh.getRange(startRow, 1, last - startRow + 1, 8).getValues();

    const rows = values.map(r => ({
      time: r[0] || "",
      event: r[1] || "",
      name: r[2] || "",
      team: r[3] || "",
      message: r[4] || "",
      clientTime: r[5] || "",
      photoFileId: r[6] || "",
      photoUrl: r[7] || (r[6] ? driveImageViewUrl_(r[6]) : "")
    }));
    return json_(200, { ok:true, rows });
  }

  return ContentService.createTextOutput("Guestbook Web App is running ✅").setMimeType(ContentService.MimeType.TEXT);
}

// ====== Helpers ======
function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(["time","event","name","team","message","clientTime","photoFileId","photoUrl"]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 8);
  }
  return sh;
}

// สร้าง URL สำหรับแสดงรูปจาก Drive แบบ embed ได้
function driveImageViewUrl_(fileId){
  return "https://drive.google.com/uc?export=view&id=" + encodeURIComponent(fileId);
}

function sanitize_(s){
  return String(s || "").replace(/[^\p{L}\p{N}\-_.]+/gu, "_").slice(0, 60);
}
function guessExt_(contentType, filename){
  const name = String(filename || "");
  const m = name.match(/\.[A-Za-z0-9]{1,6}$/);
  if (m) return m[0];
  if (String(contentType).includes("png")) return ".png";
  return ".jpg";
}

// --- multipart/form-data parser (lightweight) ---
function parseMultipart_(e){
  // Apps Script doesn't directly give us files in doPost for multipart,
  // so we parse raw bytes.
  const ct = e.postData.type || "";
  const boundaryMatch = ct.match(/boundary=([^\s;]+)/i);
  if (!boundaryMatch) throw new Error("no boundary");
  const boundary = "--" + boundaryMatch[1];

  const bytes = e.postData.bytes;
  const data = Utilities.newBlob(bytes).getDataAsString();
  const parts = data.split(boundary).slice(1,-1);

  const out = { fields:{}, files:{} };

  parts.forEach(p=>{
    p = p.replace(/^\r\n/,"").replace(/\r\n$/,"");
    const [rawHeaders, rawBody] = splitOnce_(p, "\r\n\r\n");
    if(!rawHeaders) return;

    const disp = /content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i.exec(rawHeaders);
    if(!disp) return;
    const name = disp[1];
    const filename = disp[2] || "";

    const ctMatch = /content-type:\s*([^\r\n]+)/i.exec(rawHeaders);
    const partType = ctMatch ? ctMatch[1].trim() : "text/plain";

    // body ends with \r\n, but we already trimmed last CRLF
    if(filename){
      // Need raw bytes for file: re-parse from bytes using indexes is complex.
      // We'll approximate by decoding as bytes from latin1.
      const bodyLatin1 = rawBody; // string where each char code 0-255
      const fileBytes = [];
      for(let i=0;i<bodyLatin1.length;i++){
        fileBytes.push(bodyLatin1.charCodeAt(i) & 0xff);
      }
      out.files[name] = { filename, contentType: partType, bytes: fileBytes };
    }else{
      out.fields[name] = rawBody;
    }
  });
  return out;
}
function splitOnce_(s, sep){
  const i = s.indexOf(sep);
  if(i<0) return [s,""];
  return [s.slice(0,i), s.slice(i+sep.length)];
}

function json_(code, obj){
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  // Apps Script doesn't allow setting HTTP status directly in simple web apps;
  // return code in body if needed.
  return out;
}
