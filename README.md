# Digital Guestbook – New Year Event (1 ชุดพร้อมใช้)

ชุดนี้มี:
- `index.html` : หน้าให้แขกสแกน QR แล้วส่งชื่อ/ข้อความ/รูป
- `admin.html` : หน้าแอดมินดูข้อมูล (ต้องมี ADMIN_TOKEN)
- `slideshow.html` : เปิดบนจอ/ทีวีเพื่อวนรูป+ข้อความ (ต้องมี ADMIN_TOKEN)
- `Code.gs` : Google Apps Script (Web App) รับอัปโหลด + เก็บ Drive + บันทึก Sheet

---

## A) ตั้งค่า Google Drive & Google Sheet

1) สร้างโฟลเดอร์บน Google Drive (ในเมลผู้ดูแลคนเดียว)
2) คัดลอก `Folder ID` จาก URL
   - ตัวอย่าง: https://drive.google.com/drive/folders/XXXXXX
   - Folder ID = `XXXXXX`

3) สร้าง Google Sheet ใหม่ (ชื่ออะไรก็ได้) เพื่อเก็บรายการ Guestbook

---

## B) สร้าง Google Apps Script Web App

1) เปิด Google Sheet -> Extensions -> Apps Script
2) สร้างไฟล์ `Code.gs` แล้ววางโค้ดจากไฟล์ `Code.gs` (ในชุดนี้)
3) แก้ CONFIG ด้านบน:
   - `DRIVE_FOLDER_ID` = Folder ID (ข้อ A)
   - `ADMIN_TOKEN` = ตั้งรหัสยาว ๆ เอง (เช่น 32 ตัวอักษร)
4) กด Deploy -> New deployment -> Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
5) Copy URL ของ Web app (WEBAPP_URL)

---

## C) ตั้งค่าไฟล์เว็บ (index/admin/slideshow)

### 1) index.html
แก้:
```js
WEBAPP_URL: "PUT_YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL_HERE",
EVENT_NAME: "NewYearEvent2026"
```

### 2) admin.html
เปิดไฟล์ แล้วกรอก:
- WEBAPP_URL
- ADMIN_TOKEN
กด “โหลดข้อมูล”

### 3) slideshow.html
แก้:
```js
WEBAPP_URL: "PUT_YOUR_GOOGLE_APPS_SCRIPT_WEBAPP_URL_HERE",
ADMIN_TOKEN: "PUT_ADMIN_TOKEN_HERE",
```

---

## D) ทำให้ทุกคนเข้าเว็บได้ (ผ่านมือถือ)

คุณมี 2 ทางเลือก:

### ทางเลือก 1: ใช้ Cloudflare Pages / Netlify (แนะนำ)
อัปโหลดไฟล์ `index.html` (และถ้าต้องการ `admin.html`, `slideshow.html`) ไปโฮสต์ฟรี

### ทางเลือก 2: ใช้เครื่องคุณรันเว็บ แล้วเปิด public
ใช้ Cloudflare Tunnel (เหมือนที่คุณเคยทำ) ให้คนเข้ามาจากมือถือเน็ตนอกได้

---

## E) ทำ QR Code
เอา URL หน้า `index.html` ไปทำ QR แล้วพิมพ์แปะหน้างาน

---

## หมายเหตุเรื่อง “แชร์รูป”
สคริปต์พยายามตั้งไฟล์รูปเป็น `Anyone with the link can view` เพื่อให้ slideshow เห็นรูปได้
แต่ถ้า policy องค์กรบล็อค จะยังเก็บรูปลง Drive ได้เหมือนเดิม แต่อาจโชว์รูปบน slideshow ไม่ได้
(วิธีแก้มีได้ แต่ต้องใช้ Drive API/สิทธิ์เพิ่มเติม)

---

## โครงสร้างข้อมูลใน Sheet
คอลัมน์:
time, event, name, team, message, clientTime, photoFileId, photoUrl
