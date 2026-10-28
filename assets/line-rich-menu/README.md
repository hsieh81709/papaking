# V9.1 Lite R3：離線素材

四格固定2500×1686；左上停車、右上公園、左下公廁、右下使用說明。JSON的四個message action須與圖片固定象限精確對應。這些檔案沒有上傳／綁定至LINE，不含回報功能或位置action。

驗證：`python -O test/verify_lite.py`。圖片重建：`python tools/render_menu.py --font /path/to/legal/CJK-font --output /tmp/menu.png`，需Pillow（見tools/requirements-v9_1-lite.txt）與合法已安裝CJK字型。亦可用PAPAKING_CJK_FONT或已知Noto字型路徑，不會下載字型。

完整驗收見docs/mvp1/V9_1_LITE_R3_REVIEW.md。圖片檔案上限1MB為暫定設計值；官方API規格、現有選單備份與本人綁定、正式手機驗收未執行。不得因本機驗證PASS就發布，亦不得對僅含三個JS的planner輸出執行clasp push。
