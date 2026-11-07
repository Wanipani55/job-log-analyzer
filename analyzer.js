/**
 * ジョブログ解析ツール — analyzer.js
 *
 * パターン定義 → ログ分類 → カラー表示 → ヒント＋マニュアル抜粋表示
 */

// ===== エラー/警告パターン定義 =====
const PATTERNS = [
  // ---- IBM i / AS400 系 ----
  {
    id: "MCH1211",
    severity: "error",
    regex: /MCH1211/i,
    label: "MCH1211 — ゼロ除算",
    hint: "プログラム内でゼロ除算が発生しています。除数が 0 になる条件分岐が欠けていないか確認してください。",
    manual: "IBM i メッセージリファレンス MCH1211: 除数がゼロです。除算を行う前に除数を検証し、IF 文で保護してください。",
  },
  {
    id: "MCH3601",
    severity: "error",
    regex: /MCH3601/i,
    label: "MCH3601 — ポインタ未初期化",
    hint: "ポインタ変数が初期化されないまま参照されています。ALLOC / SET ADDRESS 命令の抜け漏れを確認してください。",
    manual: "IBM i メッセージリファレンス MCH3601: ポインタが NULL または未割り当てです。ALLOC または SET ADDRESS で初期化後に使用してください。",
  },
  {
    id: "CPF4131",
    severity: "error",
    regex: /CPF4131/i,
    label: "CPF4131 — ファイルオープンエラー",
    hint: "指定されたファイルが存在しないか権限不足でオープンできません。ファイル名・ライブラリ・オブジェクト権限を確認してください。",
    manual: "IBM i メッセージリファレンス CPF4131: ファイルをオープンできませんでした。WRKOBJ / DSPOBJD でオブジェクトの存在と権限を確認してください。",
  },
  {
    id: "CPF5029",
    severity: "error",
    regex: /CPF5029/i,
    label: "CPF5029 — レコードロック",
    hint: "別ジョブが同レコードをロック中です。WRKOBJLCK でロック状況を確認し、原因ジョブをエンドするか待機設定を調整してください。",
    manual: "IBM i メッセージリファレンス CPF5029: レコードがロックされています。WRKOBJLCK (OBJTYPE(*FILE)) でロック保持ジョブを特定してください。",
  },
  {
    id: "CPF0864",
    severity: "error",
    regex: /CPF0864/i,
    label: "CPF0864 — サブシステム未稼働",
    hint: "投入先のサブシステムが開始されていません。STRSBS または WRKSBS コマンドで状態を確認してください。",
    manual: "IBM i メッセージリファレンス CPF0864: サブシステムが稼働していません。STRSBS SBSD(<サブシステム>) で起動してください。",
  },
  {
    id: "SQL0104",
    severity: "error",
    regex: /SQL0104/i,
    label: "SQL0104 — SQL 構文エラー",
    hint: "SQL ステートメントに構文誤りがあります。エラー箇所のトークンを確認し、予約語・カラム名・テーブル名のスペルミスを修正してください。",
    manual: "DB2 for i SQL メッセージ SQL0104: 予期しないトークンです。STRSQL または ACS Run SQL Scripts で構文を検証してください。",
  },
  {
    id: "SQL0204",
    severity: "error",
    regex: /SQL0204/i,
    label: "SQL0204 — テーブル/オブジェクト不在",
    hint: "参照先のテーブルまたはビューが見つかりません。スキーマ名・テーブル名のスペルと大小文字区別を確認してください。",
    manual: "DB2 for i SQL メッセージ SQL0204: オブジェクトが見つかりません。DSPFD または STRSQL の NAMING オプションを確認してください。",
  },
  {
    id: "ABEND",
    severity: "error",
    regex: /\bABEND\b/i,
    label: "ABEND — 異常終了",
    hint: "ジョブが異常終了しています。直前のメッセージ ID と詳細を確認して根本原因を特定してください。",
    manual: "ABEND は Abnormal End の略です。DSPJOBLOG でジョブログ全体を参照し、先行するエラーメッセージから原因を調査してください。",
  },
  {
    id: "MSGID_CPF",
    severity: "error",
    regex: /CPF[0-9A-Z]{4}/,
    label: "CPFxxxx — システムエラー",
    hint: "IBM i のシステムメッセージが検出されました。メッセージ ID を DSPMSGD コマンドで調べ、詳細と回復手順を確認してください。",
    manual: "DSPMSGD MSGID(CPFxxxx) MSGF(QCPFMSG) で原因コードと修復アクションを参照してください。",
  },
  // ---- Java / 一般アプリ系 ----
  {
    id: "NullPointerException",
    severity: "error",
    regex: /NullPointerException/i,
    label: "NullPointerException",
    hint: "null 参照にアクセスしています。スタックトレースを確認して null になりうる変数を特定し、null チェックを追加してください。",
    manual: "Java 言語仕様: NullPointerException は null 参照に対してメソッド呼び出し・フィールドアクセスを行った際にスローされます。Optional またはガード節で保護してください。",
  },
  {
    id: "OutOfMemoryError",
    severity: "error",
    regex: /OutOfMemoryError/i,
    label: "OutOfMemoryError",
    hint: "ヒープメモリが不足しています。-Xmx パラメータでヒープ上限を増やすか、メモリリークを調査してください。",
    manual: "JVM 起動オプション: -Xmx<size>m でヒープ上限を設定できます。VisualVM / IBM Health Center でヒープダンプを取得してリーク箇所を分析してください。",
  },
  {
    id: "SocketTimeoutException",
    severity: "error",
    regex: /SocketTimeoutException/i,
    label: "SocketTimeoutException",
    hint: "ネットワーク接続がタイムアウトしました。接続先ホスト・ポート・ファイアウォール設定を確認してください。",
    manual: "Java SocketTimeoutException: setSoTimeout() または接続設定のタイムアウト値を見直し、ネットワーク疎通を ping / telnet で確認してください。",
  },
  // ---- 警告系 ----
  {
    id: "WARN_LOCK",
    severity: "warning",
    regex: /\b(LOCK WAIT|LOCK TIMEOUT|ロック待機)\b/i,
    label: "ロック待機",
    hint: "ロック待機が発生しています。長時間待機が繰り返される場合はデッドロックの可能性があります。",
    manual: "WRKOBJLCK または WRKJOB で競合ジョブを確認し、トランザクションの順序を統一することでデッドロックを防げます。",
  },
  {
    id: "WARN_DISK",
    severity: "warning",
    regex: /\b(DISK|ASP)\s*(FULL|USAGE|[0-9]{2,3}%)/i,
    label: "ディスク使用率警告",
    hint: "ディスク (ASP) 使用率が高くなっています。不要ジャーナルレシーバー・スプールファイルを削除してください。",
    manual: "WRKDSKSTS でディスク使用量を確認し、DLTJRNRCV / DLTSPLF または RCLSTG コマンドで領域を解放してください。",
  },
  {
    id: "WARN_DEPRECATED",
    severity: "warning",
    regex: /\b(deprecated|廃止予定)\b/i,
    label: "非推奨 API 使用",
    hint: "廃止予定の API またはコマンドが使用されています。次期バージョンで削除される可能性があるため、代替手段に移行してください。",
    manual: "リリースノートおよび IBM i インフォメーションセンターで後継 API / コマンドを確認し、計画的に移行してください。",
  },
];

// ===== 行分類関数 =====
function classifyLine(line) {
  for (const p of PATTERNS) {
    if (p.regex.test(line)) {
      return { severity: p.severity, pattern: p };
    }
  }
  if (/\b(error|エラー|失敗|FAILED|EXCEPTION)\b/i.test(line)) {
    return {
      severity: "error",
      pattern: {
        id: "GENERIC_ERROR",
        label: "エラー (汎用)",
        hint: "エラーが検出されました。前後の行と合わせて文脈を確認してください。",
        manual: "ジョブログ全体を確認し、このエラーの直前に出力されたメッセージから根本原因を特定してください。",
      },
    };
  }
  if (/\b(warn|warning|警告)\b/i.test(line)) {
    return {
      severity: "warning",
      pattern: {
        id: "GENERIC_WARN",
        label: "警告 (汎用)",
        hint: "警告メッセージが検出されました。放置すると後続処理に影響する場合があります。",
        manual: "警告内容の詳細を参照し、業務影響がないかを確認してください。",
      },
    };
  }
  if (/\b(COMPLETED|NORMAL|正常|成功|OK|started|running)\b/i.test(line)) {
    return { severity: "ok", pattern: null };
  }
  if (/\b(INFO|情報|notice)\b/i.test(line)) {
    return { severity: "info", pattern: null };
  }
  return { severity: "normal", pattern: null };
}

// ===== DOM 要素取得 =====
const logInput = document.getElementById("log-input");
const analyzeBtn = document.getElementById("analyze-btn");
const clearBtn = document.getElementById("clear-btn");
const outputSection = document.getElementById("output-section");
const detailSection = document.getElementById("detail-section");
const logDisplay = document.getElementById("log-display");
const detailList = document.getElementById("detail-list");
const summaryBadge = document.getElementById("summary-badge");

// ===== 解析実行 =====
analyzeBtn.addEventListener("click", () => {
  const raw = logInput.value;
  if (!raw.trim()) return;

  const lines = raw.split("\n");
  const findings = []; // { lineIndex, line, severity, pattern }

  // ログ表示を組み立て
  logDisplay.innerHTML = "";
  lines.forEach((line, i) => {
    const { severity, pattern } = classifyLine(line);
    const span = document.createElement("span");
    const escaped = escapeHtml(line || " ");

    span.textContent = escaped;
    if (severity === "error") {
      span.className = "line-error";
      findings.push({ lineIndex: i + 1, line, severity, pattern });
      span.dataset.findingIndex = findings.length - 1;
      span.addEventListener("click", () => scrollToDetail(findings.length - 1));
    } else if (severity === "warning") {
      span.className = "line-warning";
      findings.push({ lineIndex: i + 1, line, severity, pattern });
      span.dataset.findingIndex = findings.length - 1;
      span.addEventListener("click", () => scrollToDetail(findings.length - 1));
    } else if (severity === "info") {
      span.className = "line-info";
    } else if (severity === "ok") {
      span.className = "line-ok";
    } else {
      span.className = "line-normal";
    }
    logDisplay.appendChild(span);
  });

  // サマリーバッジ更新
  const errCount = findings.filter((f) => f.severity === "error").length;
  const warnCount = findings.filter((f) => f.severity === "warning").length;
  summaryBadge.classList.remove("hidden", "ok");
  if (errCount === 0 && warnCount === 0) {
    summaryBadge.textContent = "✅ 問題なし";
    summaryBadge.classList.add("ok");
  } else {
    summaryBadge.textContent =
      `🔴 エラー ${errCount} 件 ` + (warnCount > 0 ? `  ⚠️ 警告 ${warnCount} 件` : "");
  }

  // 詳細カード組み立て
  detailList.innerHTML = "";
  if (findings.length === 0) {
    detailList.innerHTML = `<p style="color:#57606a;font-size:.88rem;">エラー・警告は検出されませんでした。</p>`;
  } else {
    findings.forEach((f, idx) => {
      const card = buildDetailCard(f, idx);
      detailList.appendChild(card);
    });
  }

  // セクション表示
  outputSection.classList.remove("hidden");
  detailSection.classList.remove("hidden");
  outputSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

// ===== クリア =====
clearBtn.addEventListener("click", () => {
  logInput.value = "";
  outputSection.classList.add("hidden");
  detailSection.classList.add("hidden");
  summaryBadge.classList.add("hidden");
  logDisplay.innerHTML = "";
  detailList.innerHTML = "";
  logInput.focus();
});

// ===== 詳細カード生成 =====
function buildDetailCard(finding, idx) {
  const { lineIndex, line, severity, pattern } = finding;
  const card = document.createElement("div");
  card.className = `detail-card severity-${severity}`;
  card.id = `detail-${idx}`;

  const sevTag = severity === "error" ? "error" : "warning";
  const sevLabel = severity === "error" ? "ERROR" : "WARNING";

  card.innerHTML = `
    <div class="detail-header">
      <span class="severity-tag ${sevTag}">${sevLabel}</span>
      <span class="detail-code" title="${escapeHtml(line)}">行 ${lineIndex}: ${escapeHtml(line.trim().slice(0, 80))}${line.trim().length > 80 ? "…" : ""}</span>
    </div>
    <div class="detail-body">
      <p class="detail-hint"><strong>${escapeHtml(pattern.label)}</strong><br>${escapeHtml(pattern.hint)}</p>
      <div class="detail-manual">${escapeHtml(pattern.manual)}</div>
    </div>
  `;
  return card;
}

// ===== 詳細カードへスクロール =====
function scrollToDetail(idx) {
  const el = document.getElementById(`detail-${idx}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ===== HTML エスケープ =====
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
