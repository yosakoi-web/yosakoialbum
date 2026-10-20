# ちゃわん娘アルバム 📸

PCから写真をアップロードして、スマホから見たり保存したりするための写真アルバムサイトです。**GitHub Pagesで公開**できます。

## できること

- トップに「ちゃわん娘アルバム」、アルバム一覧に「にっぽんど真ん中祭り」「萩原チンドン祭り」「MAHA-G」
- スマホのアルバム画面で写真を**横2列**に表示（PCは画面幅に応じて3～4列）
- 写真をタップして大きく表示／左右スワイプ／写真1枚のダウンロード
- アルバム一覧と各アルバムページから、全写真を**個別連続ダウンロード**、または**ZIPで一括ダウンロード**
- PCから写真を追加したら、GitHub Actionsがサムネイル・一覧・ZIPを自動生成して再公開
- ダウンロードされる画像は**オリジナルの画質**（縮小されるのは一覧用サムネイルのみ）

> ⚠️ **公開範囲について**：通常の GitHub Pages は一般公開です。URLを1人にだけ教えても、本人限定のアクセス制御にはなりません。写真の被写体・公開許諾にご注意ください。

## 最初の公開手順（GitHubのブラウザ操作）

1. [GitHub](https://github.com/)にログインして、新しい**Public**リポジトリを作成。例：`chawanmusu-album`。
2. このZIPを解凍し、**中身**をリポジトリのルートにアップロードします。`.github/workflows/deploy.yml` も含めてください（Web版GitHubで隠しフォルダのアップロードがうまくいかないときは、GitHub Desktopを使うと便利）。
3. リポジトリの **Settings → Pages → Build and deployment → Source → GitHub Actions** を選択します。
4. **Actions** タブで「写真アルバムを公開」ワークフローが成功するのを確認します。必要に応じて **Run workflow** を押してください。
5. Pages欄に表示されたURL（通常 `https://ユーザー名.github.io/chawanmusu-album/`）を相手に送れば閲覧できます。

### 写真の追加

GitHub上の該当フォルダに写真を入れてコミットするだけです。

| GitHub内のフォルダ | サイトに表示される名前 |
|---|---|
| `photos/domanaka/` | にっぽんど真ん中祭り |
| `photos/hagiwara/` | 萩原チンドン祭り |
| `photos/maha-g/` | MAHA-G |

例えば「萩原チンドン祭り」なら、GitHubで `photos/hagiwara/` を開き、**Add file → Upload files** でJPEGを入れて **Commit changes** してください。公開は自動更新されます。

- 画像は **JPG / JPEG / PNG / WebP** に対応。RAW/HEICは事前にJPEG等へ書き出してください。
- 一覧の並び順は**ファイル名順**（`001.jpg`, `002.jpg`, `003.jpg` … がおすすめ）。最初の写真がアルバムの表紙になります。
- ブラウザからのアップロードは**1ファイル25 MiBまで／同時に100ファイルまで**。多いときはGitHub Desktopで追加してください。
- ファイルを削除すると次回の公開時にアルバムからも消えます（ただし過去のGit履歴には残る点に注意）。

### アルバムを増やす・名前を変更する

`config/albums.json` を編集してください。例：

```json
{"id":"new-festival","title":"新しいお祭り","description":"楽しい思い出","theme":"peach"}
```

を `albums` 配列へ追加し、`photos/new-festival/` に写真を入れます。`id`は半角英小文字・数字・ハイフンのみで指定してください。`theme` は `peach` / `mint` / `lavender` から選べます。

## ダウンロードについて

- **プレビュー画面「この写真を保存」**：1枚ずつ元画像をダウンロード。
- **アルバム「まとめて保存」→「写真を1枚ずつ保存」**：写真ごとに自動で保存を試みます。ただし**スマホのブラウザ（特にiOS Safari）では複数の自動ダウンロードが制限**されるため、全件保存できる保証はありません。
- **アルバム「まとめて保存」→「ZIPでまとめて保存」**：1ファイルのZIPをダウンロード。iPhoneなら「ファイル」アプリから解凍できます。こちらのほうが一括保存は安定します。

## 容量について

GitHub Pagesで公開できるサイトには**1 GBのサイズ上限**があります。このサイトは「元画像＋サムネイル＋一括ZIP」を公開するため、画像の合計容量より大きくなります。数百～数千枚の高画質写真を長期保存する用途には向きません。画像が多い場合は、写真自体を別ストレージに置く構成へ変更するほうが安心です。GitHubの通常リポジトリへは、1ファイル100 MiBを超えるファイルを保存できません。**Git LFSはGitHub Pages配信では利用できません。**

## PCでローカル確認する（任意）

PythonがインストールされているPCで：

```bash
python -m pip install -r requirements.txt
python scripts/build.py
python -m http.server 8000 --directory dist
```

ブラウザで `http://localhost:8000/` を開いてください。`index.html` をファイルとして直接開くと、JSONデータを読み込めない場合があります。

## フォルダ構成

```
chawanmusu-album/
├─ .github/workflows/deploy.yml    ← GitHub Pagesの自動公開
├─ config/albums.json             ← アルバム名・並び順
├─ photos/
│  ├─ domanaka/                  ← にっぽんど真ん中祭りの写真
│  ├─ hagiwara/                  ← 萩原チンドン祭りの写真
│  └─ maha-g/                    ← MAHA-Gの写真
├─ scripts/build.py               ← 写真からサイトとZIPを自動生成
├─ site/                          ← Webサイトの見た目と動作
└─ requirements.txt
```

作成された `dist/` はGitHubにアップロードしなくてもOK（GitHub Actionsで生成されます）。
