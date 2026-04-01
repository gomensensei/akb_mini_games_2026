# AKB48 Fan Quest | AKB48 粉絲入門挑戰 | AKB48 ファン入門テスト

![Version](https://img.shields.io/badge/Version-2026.04.02-pink)
![License](https://img.shields.io/badge/License-Non--Commercial-blue)
![Platform](https://img.shields.io/badge/Platform-Web-orange)

---

## 🌟 專案簡介 | Project Overview | プロジェクト概要

**[ZH]** 這是一個專為 AKB48 粉絲打造的互動式網頁趣味小遊戲。本專案的初衷是希望透過多樣化的挑戰，讓新粉絲能進一步了解成員並學習如何支持她們，同時讓資深粉絲能從中發掘更多成員的魅力，達成「推し増し」（增加新推）的目標。網站採用純前端技術開發，保證了極致的載入速度與隱私安全。

**[EN]** This is an interactive web-based mini-game tailored for AKB48 fans. The project aims to help new fans learn more about the members and support them through various challenges, while providing long-time fans a chance to rediscover member charms and find new favorites ("Oshimashi"). Developed using pure front-end technologies, it ensures lightning-fast loading speeds and user privacy.

**[JP]** 本プロジェクトは、AKB48ファンのために制作されたインタラクティブなウェブミニゲームです。新規ファンの方々にはメンバーについてより深く知ってもらい、ベテランファンの方々にはメンバーの新たな魅力を再発見して「推し増し」してもらうことを目的としています。純粋なフロントエンド技術で開発されており、圧倒的な読み込み速度とプライバシーの安全性を両立しています。

---

## 🎮 遊戲模式詳細說明 | Detailed Game Modes | ゲームモード詳細説明

### 1. 笑容探照燈 | Smile Spotlight | 笑顔サーチ
* **[ZH]** 畫面被磨砂玻璃覆蓋，只有一個移動的圓形探照燈。玩家需透過有限的視覺線索猜出隱藏在後方的成員。
* **[EN]** The screen is covered with frosted glass, leaving only a moving circular spotlight. Players must guess the hidden member using limited visual cues.
* **[JP]** 画面がすりガラスで覆われ、動く円形のスポットライトだけが見えます。限られた視覚情報から、背後に隠れているメンバーを推測します。

### 2. 誰是前輩 | Who is Senpai | 先輩は誰？
* **[ZH]** 同場競技的兩位成員，誰的加入時間更早？考驗你對 AKB48 歷史與期別的記憶。
* **[EN]** Between two members on the screen, who debuted earlier? Test your memory of AKB48's history and generations.
* **[JP]** 画面に表示された2人のメンバーのうち、どちらが先に加入したかを当てます。AKB48の歴史や期別に関する知識が試されます。

### 3. 前輩排序 | Senpai Sorter | 先輩順ソート
* **[ZH]** 系統隨機抽取 4 位成員，玩家需按照她們的加入年份由早到晚進行排序。
* **[EN]** Four members are randomly selected; players must arrange them in order from their debut year (earliest to latest).
* **[JP]** ランダムに選ばれた4人のメンバーを、加入時期が早い順に並べ替えます。

### 4. 推し找出 | Find Oshi | 推し探し
* **[ZH]** 目標成員的圖示會在螢幕上快速飛行，玩家必須在限定時間內點擊捕捉她。
* **[EN]** The target member's icon flies across the screen; players must tap to capture her within the time limit.
* **[JP]** ターゲットとなるメンバーのアイコンが画面内を飛び回ります。制限時間内にタップして捕まえましょう。

### 5. 局部解碼 | Detail Decode | 部分解読
* **[ZH]** 圖片會被極度放大並逐漸縮小。玩家需從局部的特徵（如眼睛、笑容）中認出成員。
* **[EN]** An image is extremely zoomed in and gradually zooms out. Players must identify the member from specific features like eyes or smiles.
* **[JP]** 写真が極端に拡大された状態から徐々に縮小していきます。目元や口元などの特徴からメンバーを特定します。

### 6. 成員對對碰 | Memory Match | メンバー神経衰弱
* **[ZH]** 經典的記憶翻牌遊戲，找出所有成對的成員圖示。
* **[EN]** A classic memory card game. Find and match all pairs of member icons.
* **[JP]** 定番のメモリーゲームです。すべてのメンバーのペアを見つけて揃えます。

### 7. 碎片拼圖 | Photo Puzzle | 写真パズル
* **[ZH]** 圖片被切碎成 9 宮格並隨機旋轉。玩家需透過點擊旋轉與互換位置來還原精美照片。
* **[EN]** An image is divided into a 3x3 grid and randomly rotated. Players must tap to rotate and swap pieces to restore the photo.
* **[JP]** 写真が3x3のグリッドに分割され、ランダムに回転しています。ピースをタップして回転させたり、位置を入れ替えたりして写真を完成させます。

### 8. 應援色鑑定 | Oshi Color Guess | 推し色クイズ
* **[ZH]** 根據成員專屬的應援色組合（如「粉紅色與白色」），猜出對應的成員是誰。
* **[EN]** Guess the member based on their unique Oshi color combination (e.g., "Pink and White").
* **[JP]** メンバー固有のペンライトカラーの組み合わせ（例：「ピンク×白」）から、どのメンバーかを当てます。

---

## 🚀 技術亮點 | Technical Highlights | 技術的特徴

* **Dynamic Resource Pooling (動態存活卡池)**
    * **[ZH]** 具備後台自動重試載入機制。若圖片載入失敗，該成員將自動從隨機池中剔除，確保玩家絕不會看到死圖。
    * **[EN]** Features a background auto-retry loading mechanism. If an image fails to load, the member is automatically removed from the random pool to ensure no broken images.
    * **[JP]** バックグラウンドでの自動再試行機能を搭載。画像の読み込みに失敗したメンバーは自動的に抽選プールから除外され、リンク切れ画像が表示されるのを防ぎます。

* **Delta Time Engine (時間差補償引擎)**
    * **[ZH]** 飛行與動畫速度不再受螢幕更新率（Hz）影響。無論在 60Hz 還是 144Hz 螢幕上，遊戲速度完全一致。
    * **[EN]** Movement and animation speeds are independent of screen refresh rates (Hz). The game speed remains consistent across 60Hz, 120Hz, or 144Hz displays.
    * **[JP]** アニメーション速度がリフレッシュレート（Hz）に依存しません。60Hzでも144Hzでも、全く同じゲームスピードでプレイ可能です。

* **Batch Image Preloader (分批非同步預載)**
    * **[ZH]** 在首頁載入期間分批預下載成員圖片，並即時回饋進度百分比，大幅優化初次遊玩的流暢度。
    * **[EN]** Pre-downloads member images in batches during the intro screen with real-time progress updates, significantly improving first-time play smoothness.
    * **[JP]** イントロ画面中に画像をバッチ処理で非同期読み込みし、進捗状況を％で表示します。初回プレイ時の快適性を大幅に向上させました。

* **Native Game Feel (原生手感優化)**
    * **[ZH]** 內建封鎖文字反白、圖片拖曳與系統長按選單，模擬原生手機 App 的極致遊玩體驗。
    * **[EN]** Disables text selection, image dragging, and system long-press menus to simulate a premium native mobile app experience.
    * **[JP]** テキスト選択、画像のドラッグ、長押しメニューを無効化し、まるでネイティブアプリのような操作感を実現しました。

---

## 📄 版權與免責聲明 | Copyright & Disclaimer | 著作権と免責事項

**[ZH]** 本專案為粉絲製作之非商業性作品，僅供學術交流及粉絲互動使用。網頁內使用之所有成員圖片、商標及相關素材之版權均歸 **©AKB48** 及 **株式会社DH** 所有。請勿將本專案用於任何商業用途。

**[EN]** This project is a non-commercial fan-made work for academic exchange and fan interaction only. All member photos, trademarks, and related materials used within the website are the property of **©AKB48** and **DH Co., Ltd.** Commercial use of this project is strictly prohibited.

**[JP]** 本プロジェクトはファンによって制作された非営利目的の作品であり、学習およびファン同士の交流のみを目的としています。使用されているすべてのメンバー写真、商標、および関連素材の著作権は、**©AKB48** および **株式会社DH** に帰属します。商用利用は固く禁止されています。

---

## 制作 | Created by

**ゴメン先生 (gomensensei)**
