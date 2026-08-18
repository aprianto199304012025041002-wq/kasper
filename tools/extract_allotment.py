#!/usr/bin/env python3
"""
Ekstraksi data allotment kanal FM dari KM Komdigi No. 570 Tahun 2025
Menggunakan Anthropic Vision API untuk baca tabel scan PDF

Cara pakai:
  pip install anthropic pdf2image pillow
  apt install poppler-utils  # atau brew install poppler di Mac
  
  export ANTHROPIC_API_KEY=sk-ant-...
  python extract_allotment.py --pdf 2025kepmen570_1_.pdf --output api/data/allotment_nasional.json

  # Kalau mau proses halaman tertentu saja (misal cek dulu):
  python extract_allotment.py --pdf 2025kepmen570_1_.pdf --pages 73-87 --output test.json
"""

import anthropic
import base64
import json
import argparse
import sys
import time
from pathlib import Path
from pdf2image import convert_from_path

SYSTEM_PROMPT = """Kamu adalah ekstractor data tabel dari dokumen scan PDF regulasi Indonesia.
Tugasmu: ekstrak data tabel allotment kanal FM dari halaman yang diberikan.

Format output HARUS berupa JSON array of objects. Setiap objek adalah satu baris tabel dengan field:
{
  "no": <integer nomor urut>,
  "kode": "<kode integrasi wilayah layanan, contoh: 33-001>",
  "provinsi": "<nama provinsi>",
  "kota_kabupaten": "<nama kota/kabupaten>",
  "nama_wilayah": "<nama wilayah layanan>",
  "koordinat_perbatasan": "<Ya atau Tidak>",
  "longitude": "<contoh: 109E00 34>",
  "latitude": "<contoh: 07S31 07>",
  "kelas": "<A, B, atau C>",
  "rri": [<array integer nomor kanal untuk LPP RRI>],
  "lps": [<array integer nomor kanal untuk LPP Lokal dan LPS>]
}

PENTING:
- Kanal adalah bilangan bulat (integer), bukan frekuensi. Kolom "LPP RRI" dan "LPP Lokal, LPS" berisi nomor kanal.
- Jika kolom kosong, gunakan array kosong []
- Jika ada multiple nilai kanal dipisah koma, masukkan semua ke array
- Output HANYA JSON array, tanpa penjelasan, tanpa markdown backticks
- Jika halaman tidak mengandung tabel data (halaman judul, tanda tangan, dsb), output: []
"""

def image_to_base64(img):
    import io
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=90)
    return base64.standard_b64encode(buf.getvalue()).decode('utf-8')

def extract_page(client, img, page_num, retries=3):
    b64 = image_to_base64(img)
    for attempt in range(retries):
        try:
            resp = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64
                            }
                        },
                        {
                            "type": "text",
                            "text": f"Ekstrak semua baris tabel dari halaman ini (halaman PDF nomor {page_num}). Output JSON array saja."
                        }
                    ]
                }]
            )
            text = resp.content[0].text.strip()
            # Strip markdown jika ada
            if text.startswith('```'):
                text = text.split('\n', 1)[1]
                text = text.rsplit('```', 1)[0]
            data = json.loads(text)
            return data
        except json.JSONDecodeError as e:
            print(f"  [pg {page_num}] JSON parse error (attempt {attempt+1}): {e}", file=sys.stderr)
            if attempt < retries - 1:
                time.sleep(2)
        except anthropic.RateLimitError:
            print(f"  [pg {page_num}] Rate limit, tunggu 30 detik...", file=sys.stderr)
            time.sleep(30)
        except Exception as e:
            print(f"  [pg {page_num}] Error (attempt {attempt+1}): {e}", file=sys.stderr)
            if attempt < retries - 1:
                time.sleep(5)
    return []

def parse_page_range(s, total):
    """Parse '73-87' atau '73,74,75' atau 'all'"""
    if s == 'all' or s is None:
        return list(range(1, total + 1))
    if '-' in s:
        a, b = s.split('-')
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in s.split(',')]

def main():
    parser = argparse.ArgumentParser(description='Ekstrak allotment FM dari PDF KM 570/2025')
    parser.add_argument('--pdf', required=True, help='Path ke file PDF')
    parser.add_argument('--output', required=True, help='Output JSON file')
    parser.add_argument('--pages', default='all', help='Range halaman: all / 73-87 / 73,74,75')
    parser.add_argument('--resume', action='store_true', help='Lanjutkan dari output yang sudah ada')
    parser.add_argument('--dpi', type=int, default=200, help='DPI rasterisasi (default: 200)')
    args = parser.parse_args()

    client = anthropic.Anthropic()  # pakai ANTHROPIC_API_KEY dari env

    print(f"Membuka PDF: {args.pdf}")
    # Hitung total halaman dulu tanpa load semua
    from pdf2image import pdfinfo_from_path
    info = pdfinfo_from_path(args.pdf)
    total_pages = info['Pages']
    print(f"Total halaman: {total_pages}")

    pages = parse_page_range(args.pages, total_pages)
    # Halaman 1-5 adalah cover/pasal (skip otomatis jika hasilnya [])
    print(f"Akan proses {len(pages)} halaman: {pages[0]}–{pages[-1]}")

    # Load existing output jika resume
    all_data = []
    done_pages = set()
    out_path = Path(args.output)
    if args.resume and out_path.exists():
        with open(out_path) as f:
            existing = json.load(f)
        # Cari halaman yang sudah selesai dari metadata
        meta_path = out_path.with_suffix('.meta.json')
        if meta_path.exists():
            with open(meta_path) as f:
                done_pages = set(json.load(f).get('done_pages', []))
        all_data = existing
        print(f"Resume: {len(done_pages)} halaman sudah selesai, {len(all_data)} baris loaded")

    meta_path = out_path.with_suffix('.meta.json')

    for pg in pages:
        if pg in done_pages:
            print(f"  [pg {pg}] Skip (sudah selesai)")
            continue

        print(f"  [pg {pg}] Rasterisasi...", end=' ', flush=True)
        imgs = convert_from_path(args.pdf, dpi=args.dpi, first_page=pg, last_page=pg)
        if not imgs:
            print("kosong, skip")
            continue

        print(f"Ekstrak via Vision API...", end=' ', flush=True)
        rows = extract_page(client, imgs[0], pg)
        print(f"{len(rows)} baris")

        all_data.extend(rows)
        done_pages.add(pg)

        # Save setelah setiap halaman (biar aman kalau interrupt)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        with open(meta_path, 'w') as f:
            json.dump({'done_pages': sorted(done_pages)}, f)

        # Rate limit courtesy delay
        time.sleep(1)

    print(f"\nSelesai! Total {len(all_data)} wilayah layanan")
    print(f"Output: {out_path}")

    # Cleanup meta
    if meta_path.exists():
        meta_path.unlink()

if __name__ == '__main__':
    main()
