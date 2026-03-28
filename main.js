// ===== imports =====

/* ---- constants ---- */
import { Decimal, D } from "./src/constants/numbers.js";

// 1.79e308
import {
    INF
} from "./src/constants/numbers.js";

import { UI_LAYOUT } from "./src/constants/uiLayout.js";

import { SAVE_KEY } from "./src/constants/save.js";

// fps
import { TARGET_FPS, FRAME_INTERVAL_MS } from "./src/constants/timing.js";

// 自動化
import { createAutomationLogic } from "./src/systems/automationSystem.js";

// アンロックに必要なずんだ量
import {
    ASC_UNLOCK,
    PRESTIGE_UNLOCK,
    BOOST_UNLOCK,
    EDA_UNLOCK,
    AUTO_THRESH_BY_ZUNDA
} from "./src/constants/unlockZundaAmount.js";


// キャラクター表示

// セリフの表示時間 = 60秒
import { ZUNDA_AUTO_DELAY_MS } from "./src/constants/zundaTalk.js";

import { ZUNDA_SPRITE } from "./src/constants/zundaSprites.js";

import {
    ZUNDA_LINES_NORMAL,
    ZUNDA_LINES_BY_PROGRESS
} from "./src/constants/zundaLines.js";

import { createBubble } from "./src/ui/bubble.js";


// UI
import { initTabs } from "./src/ui/tabs.js";
import { initAutomationUI } from "./src/ui/automationUI.js";
import { createAutomationCardsUI } from "./src/ui/automationCards.js";
import { initAskillTree } from "./src/ui/askillTree.js";
import { initAnkoChallengeUI } from "./src/ui/ankoChallengesUI.js";
let onAnkoChalUIUpdate = null;
import { createCostsUI } from "./src/ui/costsUI.js";
import { createVisibilityUI } from "./src/ui/visibilityUI.js";
import { createPrestigeUI } from "./src/ui/prestigeUI.js";
import { createBoostAscUI } from "./src/ui/boostAscUI.js";
import { createHUD } from "./src/ui/hud.js";
import { createZundaDimsUI } from "./src/ui/zundaDimsUI.js";
import { createMiscBars } from "./src/ui/miscBars.js";
import { createUpdateUI } from "./src/ui/updateUI.js";


// ずんだディメンション
import { calcTickMults } from "./src/systems/mults.js";
import { tickZunda } from "./src/systems/zundaProduction.js";

// ずんだアセンション
import { createAscensionSystem } from "./src/systems/ascension.js";

// ずんだプレステージ
import { createPrestigeSystem, PRESTIGE_REF, PRESTIGE_P, PRESTIGE_S } from "./src/systems/prestigeSystem.js";

// あんこディメンション
import {
    calcAdCost,
    calcAdTotalCost,
    canAffordAd,
    maxAffordableAd,
} from "./src/content/ankoDims.js";

import { tickAnko } from "./src/systems/ankoProduction.js";

// あんこスキル
import {
    ASKILL_COSTS,
    ASKILL_PREREQ,
    ASKILL_POS,
    ASKILL_EDGES,
    getASkillLabel,
    getASkillDesc
} from "./src/constants/ankoSkills.js";

// あんこチャレンジ
import { ACHAL_DEFS } from "./src/constants/achallengeDefs.js";
import { createAnkoChallengeLogic } from "./src/systems/ankoChallenge.js";


/***** 0. BANNER ************************************************************/
/* 依存順: Utils → State → Effects → Math → Actions → UI → Events → Loop → Boot */


/***** 1. UTILS *************************************************************/



// Decimal/number/BreakInfinity を問わず "数値" に落とす
function toNum(x) {
    if (x && typeof x.toNumber === 'function') return x.toNumber();
    return Number(x);
}

// 表示フォーマッタ（Decimal対応）
function fmtDec(d) {
    if (!(d instanceof Decimal)) d = D(d || 0);

    // ゼロ
    if (d.eq(0)) return '0';

    const abs = d.abs();

    // 小さい値～通常値（安全に toNumber）
    if (abs.gte(1e-4) && abs.lt(1e7)) {
        const n = toNum(d); // この範囲は安全
        // 整数 or 少数の判断をして表示
        if (Math.abs(n - Math.round(n)) < 1e-9) {
            // ほぼ整数なら桁区切り付き整数
            return Math.round(n).toLocaleString('en-US');
        } else if (Math.abs(n) < 1) {
            // 1未満なら少数4桁
            return n.toFixed(4).replace(/\.?0+$/, '');
        } else {
            // その他は少数2桁
            return n.toFixed(2);
        }
    }

    // それ以外は指数表記
    const e = Decimal.floor(Decimal.log10(abs));
    const m = d.div(Decimal.pow(10, e));
    const sign = d.lt(0) ? '-' : '';
    return sign + m.abs().toFixed(2) + 'e' + e.toString();
}

// 表示フォーマッタ（Decimal対応・小数点以下2桁）
function fmtDec2(d) {
    if (!(d instanceof Decimal)) d = D(d || 0);

    // ゼロ
    if (d.eq(0)) return '0';

    const abs = d.abs();

    // 小さい値～通常値（安全に toNumber）
    if (abs.gte(1e-4) && abs.lt(1e7)) {
        const n = toNum(d); // この範囲は安全
        if (Math.abs(n) < 1) {
            // 1未満なら少数4桁
            return n.toFixed(4);
        } else {
            // その他は少数2桁
            return n.toFixed(2);
        }
    }

    // それ以外は指数表記
    const e = Decimal.floor(Decimal.log10(abs));
    const m = d.div(Decimal.pow(10, e));
    const sign = d.lt(0) ? '-' : '';
    return sign + m.abs().toFixed(2) + 'e' + e.toString();
}

const fmt = fmtDec;
const softFmt = fmtDec;
const fmt2 = fmtDec2;

// 安全な log10（Decimalなら d.log10()、numberなら Math.log10）
function log10Safe(d) {
    if (d && typeof d.log10 === 'function') return d.log10(); // Decimal or BreakInfinity
    return Math.log10(Number(d)); // native number
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// 現在の時間
const nowMs = () => performance?.now?.() || Date.now();

// ずんだディメンション
const tiers = Array.from({ length: 9 }, () => ({}));

/* ---- あんこチャレンジ関連 ---- */
// チャレンジに入ってから経過した時間
const ankoChalElapsedSec = () => ((nowMs() - (state.anko.chalStartMs || 0)) / 1000) | 0;
const isAnkoChal = k => state.anko.activeChal === k || (typeof k === "string" && ACHAL_DEFS[state.anko.activeChal]?.key === k);
const isChal = k => state.anko.activeChal === k || (typeof k === "string" && ACHAL_DEFS[state.anko.activeChal]?.key === k);

/* ---- UI helpers ---- */
const el = id => document.getElementById(id);


// 科学記法ふくむ数値リテラル判定用（例: 10, 1.5, 1e10, 1.23e-4）
const NUM_LITERAL_RE = /^[+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:e[+-]?\d+)?$/i;

/**
 * v が「ちゃんとした数値文字列」か判定する
 *  - 形式チェック（正規表現）
 *  - Decimal でパースできるか
 *  - min/max（Decimal）での範囲チェック（オプション）
 */
function isValidDecimalLiteral(v, opts = {}) {
    if (!NUM_LITERAL_RE.test(v)) return false;

    let d;
    try {
        d = D(v);
    } catch {
        return false;
    }
    // NaN は弾く
    if (typeof d.isNaN === 'function' && d.isNaN()) return false;

    if (opts.min !== undefined && d.lt(opts.min)) return false;
    if (opts.max !== undefined && d.gt(opts.max)) return false;

    return true;
}

// 入力途中として“ありえる”形かどうかを判定
function isMaybeNumericLiteral(v) {
    // 単なる符号だけ
    if (v === "+" || v === "-") return true;

    // 小数点まで打って終わってる
    if (/^[+-]?\d+\.$/.test(v)) return true;
    if (/^[+-]?\.\d*$/.test(v)) return true; // ".1" とか "."

    // 指数記法の途中: "1e", "1e+", "1e-"
    if (/^[+-]?(?:\d+\.?\d*|\d*\.?\d+)e[+-]?$/i.test(v)) return true;

    return false;
}

/**
 * 数値文字列用入力ハンドラをアタッチ
 *
 * @param {HTMLInputElement} inputEl 対象 input
 * @param {() => string} getValue    現在値を取得する関数（state → string）
 * @param {(v: string) => void} setValue 新しい値を保存する関数（string → state）
 * @param {Object} opts
 *   - min: Decimal での下限（任意）
 *   - max: Decimal での上限（任意）
 *   - allowEmpty: true のとき空欄を許可（デフォ false）
 */
function attachNumericInputHandler(inputEl, getValue, setValue, opts = {}) {
    if (!inputEl) return;

    // ---- 初期値の正規化 ----
    let stored = (getValue?.() ?? "").toString().trim();
    let lastValid;

    if (stored && isValidDecimalLiteral(stored, opts)) {
        // 保存されていた値がちゃんとしてる
        lastValid = stored;
    } else {
        // 保存されてた値が不正（1eee10 など）の場合はここで矯正
        lastValid = opts.default ?? "1";
        setValue?.(lastValid);
    }

    inputEl.value = lastValid;

    // ---- 入力中イベント ----
    inputEl.addEventListener("input", (e) => {
        const raw = (e.target.value ?? "").trim();

        // 空欄
        if (raw === "") {
            if (opts.allowEmpty) {
                lastValid = raw;
                setValue?.(raw);
                save?.();
                return;
            }
            // 空欄禁止 → 最後の正しい値に戻す
            e.target.value = lastValid;
            return;
        }

        // 完全に正しいかチェック
        if (!isValidDecimalLiteral(raw, opts)) {
            // まだ“途中”としてありえる形なら見逃す
            if (isMaybeNumericLiteral(raw)) {
                // 表示だけ残して state は更新しない
                return;
            }

            // どうやっても数値にならない → 最後の正しい値に戻す
            e.target.value = lastValid;
            return;
        }

        // ✅ 正しい数値 → ここで lastValid を更新
        lastValid = raw;
        setValue?.(raw);
        save?.();
    });

    // ---- フォーカス外れたときの保険 ----
    inputEl.addEventListener("blur", (e) => {
        const raw = (e.target.value ?? "").trim();

        if (raw === "") {
            if (!opts.allowEmpty) {
                e.target.value = lastValid;
            }
            return;
        }

        if (!isValidDecimalLiteral(raw, opts)) {
            e.target.value = lastValid;
        }
    });
}


/***** 2. STATE *************************************************************/

/* ---- 状態 ---- */
const state = {
    zunda: D(10),           // ずんだ数
    lastActiveMs: 0,
    runSeconds: 0,
    runSecondsAnko: 0,
    lastTime: performance.now(),
    lastSave: Date.now(),

    boostZunda: D(0),
    boostEdamame: D(0),
    boostOther: D(0),
    ascensionMult: 1,
    prestige: { speed: 0, power: 0, cost: 0 },

    maxZunda: D(10),        // 最大到達

    // 枝豆/大豆（恒久）
    eda: { amount: 0, boostBought: 0, expBought: 0 },
    soy: { amount: 0, boostUpLv: 0, zd8Lv: 0 },

    ap: D(0),                 // アンコポイント
    anconityClears: 0,     // アンコニティ達成回数
    ankoTabUnlocked: false,// あんこタブ解禁フラグ
    anconityReady: false,  // しきい値到達（停止中）

    // 進行度
    zundaProgress: 0,

    // アンロック
    autoTabUnlocked: false,
    unlocks: { boost: false, asc: false, prestige: false, allMax: false },

    // 自動化
    auto: {
        unlocked: {
            boost: false,
            zd: Array(8).fill(false),
            boostFast: false,
            zdFast: Array(8).fill(false),
            asc: false,
            prest: false,
            eda: false,
            soy: false,
            anco: false
        },
        enabled: {
            boost: false,
            zd: Array(8).fill(false),
            boostFast: false,
            zdFast: Array(8).fill(false),
            asc: false,
            prest: { speed: false, power: false, cost: false },
            // 枝豆アップグレード（2種）
            eda: {
                boost: false, // 枝豆→ブースト購入
                exp: false    // 指数強化
            },
            // 大豆アップグレード（2種）
            soy: {
                boostUp: false, // ブースト強化
                zd8: false      // ZD8強化
            },
            anco: false
        },
        ascMul: 1,
        prestMul: {
            speed: "4",
            power: "4",
            cost: "4"
        }
    }
};

// あんこ状態（未定義なら初期化）
state.anko = state.anko || {
    amount: D(0),
    dims: Array.from({ length: 9 }, (_, i) => ({
        bought: D(0),
        generated: D(1),
        prodPerSec: 1,
    })), // 1..8使用
    skills: {},
    challenges: Array.from({ length: 13 }, () => ({ cleared: false, bestTime: null })),
    chalCounters: { ascCount: 0, totalDimBought: D(0), perDimOwned: Array(9).fill(0) }
};

/* ---- Save / Load（Decimal対応） ---- */
function save() {
    // ankoの存在と最低限の型を保証
    if (!state.anko) state.anko = {};
    if (state.anko.amount == null) state.anko.amount = D(state.anko.amount || 0);
    if (!Array.isArray(state.anko.dims)) state.anko.dims = [];

    const toStr = (v) =>
        (v != null && typeof v.toString === 'function')
            ? v.toString()
            : String(v ?? 0);

    const payload = {
        zunda: state.zunda.toString(),
        lastActiveMs: state.lastActiveMs,
        runSeconds: state.runSeconds,
        lastSave: Date.now(),
        boostZunda: state.boostZunda,
        boostEdamame: state.boostEdamame,
        ascensionMult: state.ascensionMult,
        prestige: state.prestige,
        maxZunda: state.maxZunda.toString(),

        eda: state.eda,
        soy: state.soy,

        zundaProgress: state.zundaProgress,

        autoTabUnlocked: state.autoTabUnlocked,
        unlocks: state.unlocks,
        auto: state.auto,

        anko: {
            amount: toStr(state.anko.amount),
            dims: (state.anko.dims || []).map(d => ({
                i: d.i,
                bought: d.bought,
                prodPerSec: d.prodPerSec,
                generated: d.generated
            }))
        },
        ap: state.ap,
        anconityClears: state.anconityClears,
        ankoTabUnlocked: state.ankoTabUnlocked,
        anconityReady: state.anconityReady,

        tiers: tiers.slice(1).map(t => ({
            bought: t.bought, generated: t.generated, revealed: t.revealed || false
        }))
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    flashSaveStatus('保存済み');
}

// 初期化
state.ap = D(state.ap ?? 0); // 既にAPを持っているならそのまま
state.anko = state.anko || {
    amount: D(0),                              // あんこ量（Decimal）
    dims: Array.from({ length: 9 }, (_, i) => ({    // 1..8を使用
        i,
        bought: D(0),
        prodPerSec: 1,                           // 全ADの基礎生産 1/s（AD1はあんこ、AD2+は下位ADを生産）
        generated: D(1)                             // “生成数”の表示用（AD2+がAD1を増やし、AD1はあんこを増やす）
    }))
};

function load() {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
    try {
        const p = JSON.parse(raw);
        state.zunda = D(p.zunda || 10);          // Decimal
        state.lastActiveMs = p.lastActiveMs ?? p.lastSave ?? Date.now();
        state.runSeconds = Number(p.runSeconds) || 0; // 全体のプレイ時間
        state.runSecondsAnko = p.runSecondsAnko || 0;  // 現在のアンコニティのプレイ時間
        state.lastSave = Number(p.lastSave) || Date.now();
        state.boostZunda = D(p.boostZunda || 0);
        state.boostEdamame = D(p.boostEdamame || 0);
        state.ascensionMult = Number(p.ascensionMult) || 1;
        state.prestige = p.prestige || { speed: 0, power: 0, cost: 0 };
        state.maxZunda = D(p.maxZunda || 10);      // Decimal

        state.eda = p.eda || { amount: 0, boostBought: 0, expBought: 0 };
        state.soy = p.soy || { amount: 0, boostUpLv: 0, zd8Lv: 0 };

        state.zundaProgress = p.zundaProgress || 0;

        // 自動化
        state.auto = p.auto || {};
        state.auto.unlocked = p.auto.unlocked || { zd: Array(8).fill(false), boost: false };
        state.auto.enabled = p.auto.enabled || { zd: Array(8).fill(false), boost: false };
        // 高速系
        state.auto.unlocked.zdFast = p.auto.unlocked.zdFast || { zdFast: Array(8).fill(false) };
        state.auto.unlocked.boostFast = (p.auto?.unlocked?.boostFast === true);
        state.auto.unlocked.asc = p.auto.unlocked.asc || false;
        state.auto.unlocked.prest = p.auto.unlocked.prest || false;
        state.auto.unlocked.eda = p.auto.unlocked.eda || false;
        state.auto.unlocked.anco = p.auto.unlocked.anco || false;
        state.auto.enabled.zdFast = p.auto.enabled.zdFast || { zdFast: Array(8).fill(false) };
        state.auto.enabled.boostFast = !!p.auto?.enabled?.boostFast;
        state.auto.enabled.asc = p.auto.enabled.asc || false;
        state.auto.enabled.prest = p.auto.enabled.prest || false;
        state.auto.enabled.eda = p.auto.enabled.eda || false;
        state.auto.enabled.anco = p.auto.enabled.anco || false;
        state.auto.ascMul = p.auto.ascMul || 4;

        state.auto.enabled.asc = !!p.auto.enabled.asc;

        {
            const oldPrest = p.auto.enabled.prest;
            if (typeof oldPrest === 'object' && oldPrest !== null) {
                state.auto.enabled.prest = {
                    speed: !!oldPrest.speed,
                    power: !!oldPrest.power,
                    cost: !!oldPrest.cost
                };
            } else {
                const on = !!oldPrest;
                state.auto.enabled.prest = { speed: on, power: on, cost: on };
            }
        }

        // 枝豆アップグレード自動化（旧セーブ互換）
        if (typeof p.auto.enabled.eda === 'object' && p.auto.enabled.eda !== null) {
            state.auto.enabled.eda = {
                boost: !!p.auto.enabled.eda.boost,
                exp: !!p.auto.enabled.eda.exp
            };
        } else {
            const on = !!p.auto.enabled.eda;
            state.auto.enabled.eda = { boost: on, exp: on };
        }

        // 大豆アップグレード自動化（新規。旧セーブは全部OFFでスタート）
        if (typeof p.auto.enabled.soy === 'object' && p.auto.enabled.soy !== null) {
            state.auto.enabled.soy = {
                boostUp: !!p.auto.enabled.soy.boostUp,
                zd8: !!p.auto.enabled.soy.zd8
            };
        } else {
            state.auto.enabled.soy = { boostUp: false, zd8: false };
        }

        state.auto.enabled.anco = !!p.auto.enabled.anco;

        state.auto.ascMul = p.auto.ascMul ?? 4;
        state.auto.prestMul = {
            speed: (p.auto.prestMul && p.auto.prestMul.speed) ?? "4",
            power: (p.auto.prestMul && p.auto.prestMul.power) ?? "4",
            cost: (p.auto.prestMul && p.auto.prestMul.cost) ?? "4"
        };

        state.auto.unlocked.eda = p.auto.unlocked.eda || false;
        state.auto.unlocked.soy = p.auto.unlocked.soy || false;

        state.autoTabUnlocked = !!p.autoTabUnlocked;
        state.unlocks = p.unlocks || { boost: false, asc: false, prestige: false, allMax: false };

        const arr = p.tiers || [];
        for (let i = 1; i <= 8; i++) {
            if (arr[i - 1]) {
                tiers[i].bought = D(arr[i - 1].bought ?? 0);
                tiers[i].generated = D(arr[i - 1].generated ?? 1);
                tiers[i].revealed = !!arr[i - 1].revealed;
            }
        }

        if (state.autoTabUnlocked) document.getElementById("tab-auto").style.display = "block";
        if (state.unlocks?.boost) document.getElementById("boostPanel").style.display = "block";
        if (state.unlocks?.allMax) document.getElementById("allMaxPanel").style.display = "block";
        if (state.unlocks?.asc) document.getElementById("ascPanel").style.display = "block";
        if (state.unlocks?.prestige) document.getElementById("prestigePanel").style.display = "block";

        try { edaUnlocked = JSON.parse(localStorage.getItem(EDA_UNLOCK_KEY) || 'false'); } catch (e) { edaUnlocked = false; }

        if (p.anko) {
            state.anko = {
                amount: D(p.anko.amount || 0),
                dims: Array.from({ length: 9 }, (_, i) => {
                    const src = (p.anko.dims || [])[i] || { i, bought: D(0), prodPerSec: 1, generated: D(1) };
                    return { i, bought: D(src.bought) || D(0), prodPerSec: src.prodPerSec || 1, generated: D(src.generated) || D(1) };
                })
            };
        } else {
            state.anko = state.anko || {
                amount: D(0),
                dims: Array.from({ length: 9 }, (_, i) => ({ i, bought: D(0), prodPerSec: 1, generated: D(1) })),
                skills: {},
                challenges: Array.from({ length: 13 }, () => ({ cleared: false, bestTime: null }))
            };
        }
        state.ap = D(p.ap ?? 0);
        state.anconityClears = p.anconityClears || 0;
        state.ankoTabUnlocked = !!p.ankoTabUnlocked;
        state.anconityReady = !!p.anconityReady;

        state.anko.activeChal = state.anko.activeChal || null; // 現在挑戦中のチャレンジ
        state.anko.chalStartMs = state.anko.chalStartMs || 0;  // 開始時刻(ms)
        state.anko.chalCounters = state.anko.chalCounters || {
            ascCount: 0,
            totalDimBought: D(0),
            perDimOwned: Array(9).fill(0),
        };

        if (state.ankoTabUnlocked) {
            const t = document.getElementById('tab-anko');
            if (t) t.style.display = 'block';
        }
        const apEl = document.getElementById('apAmount');
        if (apEl) apEl.textContent = state.ap.toString();
        const bar = document.getElementById('anconityBar');
        if (bar) bar.style.display = state.anconityReady ? 'block' : 'none';

    } catch (e) { console.warn('Load failed', e); }
}

const OFFLINE_CAP_SEC = 24 * 60 * 60;

function applyOfflineFromLastActive({ showToast }) {
    const now = Date.now();
    const last = state.lastActiveMs ?? state.lastSave ?? now;

    let sec = (now - last) / 1000;
    if (!Number.isFinite(sec) || sec < 0) sec = 0;

    const capped = Math.min(sec, OFFLINE_CAP_SEC);

    // 二重取り防止：ここが超重要
    state.lastActiveMs = now;

    if (capped >= 0.5) { // 0.5秒未満は無視
        applyOfflineProgress(capped); // ← tickStepを回す
        if (showToast) {
            const label = (sec > OFFLINE_CAP_SEC)
                ? `オフライン: 24時間（上限）`
                : `オフライン: ${capped.toFixed(1)}秒`;
            flashSaveStatus(label);
        }
    }
}


/***** 3. EFFECTS ************************************************************/

/* ---- スキル効果 ---- */
const EFFECT_BASE = {
    zpsMul: 1,          // ZPS倍率 / 掛け算
    zdEffMul: 1,        // ZD倍率 / 掛け算
    zdEffMulFromUnspentAP: false,  // 未使用APによるZD倍率フラグ / OR
    zdCostPowAdd: 0,    // ZDコスト指数 / 足し算
    zd8EffMulByAmount: false,   // ZD8特殊倍率フラグ / OR
    zpsExpAdd: 0,       // ZPS指数 / 足し算
    ascensionPowExp: 1, // アセンション指数 / 掛け算
    zbEffMul: 1,        // ずんだブースト倍率 / 掛け算
    zbCostMul: 1,       // ずんだブーストコスト倍率 / 掛け算
    edaGetMul: 1,       // 枝豆入手倍率 / 掛け算
    edaUpgradeCostMul: 1,   // 枝豆コスト倍率 / 掛け算
    soyUpgradeCostMul: 1,   // 枝豆コスト倍率 / 掛け算
    soyGetAdd: 0,       // SoyPS加算量 / 足し算
    apMul: 1,           // AP入手量倍率 / 掛け算
    ad1Mul: 1,          // AD1倍率 / 掛け算
    ad2Mul: 1,          // AD2倍率 / 掛け算
    adMulFromClears: false, // アンコニティ回数によるAD倍率 / OR
    flags: { autoUnlocked: false, anconityBreak: false, ankoDimsDisabled: false },                 // フラグ / OR
    tabs: { edamame: false, automation: false },     // タブアンロック / OR
    startBonuses: { anconity: { zd1: 0, zb: 0, cPre: 0, zd2to6: 0 } }, // 開始時ボーナス
};

const EffectProviders = []; // {id, compute: (state) => partialEffect}

function registerEffectProvider(id, compute) {
    EffectProviders.push({ id, compute });
}

// あんこ（ツリー）→ 所持スキルを見て集約して返す
registerEffectProvider('anko', (state) => {
    const own = state.skills?.anko?.owned || {};
    const e = {
        zpsMul: 1,          // ZPS倍率 / 掛け算
        zdEffMul: 1,        // ZD倍率 / 掛け算
        zdEffMulFromUnspentAP: false,  // 未使用APによるZD倍率フラグ / OR
        zd8EffMulByAmount: false,   // ZD8特殊倍率フラグ / OR
        zdCostPowAdd: 0,    // ZDコスト指数 / 足し算
        zpsExpAdd: 0,       // ZPS指数 / 足し算
        ascensionPowExp: 1, // アセンション指数 / 掛け算
        zbEffMul: 1,        // ずんだブースト倍率 / 掛け算
        edaGetMul: 1,       // 枝豆入手倍率 / 掛け算
        soyGetAdd: 0,       // SoyPS加算量 / 足し算
        apMul: 1,           // AP入手量倍率 / 掛け算
        ad1Mul: 1,          // AD1倍率 / 掛け算
        ad2Mul: 1,          // AD2倍率 / 掛け算
        adMulFromClears: false,    // アンコニティ回数によるAD倍率 / OR
        flags: { autoUnlocked: false, anconityBreak: false },                 // 自動化アンロック / OR
        tabs: { edamame: false, automation: false },     // タブアンロック / OR
        startBonuses: { anconity: { zd1: 0, zb: 0, cPre: 0, zd2to6: 0 } }, // 開始時ボーナス
    };

    if (own.s1) {
        e.flags.autoUnlocked = true;
        e.tabs.edamame = e.tabs.automation = true;
        e.startBonuses.anconity.zd1 = Math.max(e.startBonuses.anconity.zd1, 10);
    }
    if (own.s2_1) e.zpsMul *= 25;
    if (own.s2_2) e.zpsExpAdd += 0.05;
    if (own.s3_1) e.zdEffMulFromUnspentAP = true;
    if (own.s3_2) e.ascensionPowExp *= 1.2;
    if (own.s4) e.apMul *= 2;
    if (own.s5_1) e.startBonuses.anconity.zb += 20;
    if (own.s5_2) e.zbEffMul *= 1.2;
    if (own.s5_3) e.zd8EffMulByAmount = true;
    if (own.s6_1) e.startBonuses.anconity.cPre = 15;
    if (own.s6_2) e.edaGetMul *= 5;
    if (own.s6_3) e.soyGetAdd += 3;
    if (own.s7_1) e.startBonuses.anconity.zd2to6 = 1;
    if (own.s7_2) e.ad1Mul *= 3;
    if (own.s7_3) e.ad2Mul *= 1.5;
    if (own.s8_1) e.flags.anconityBreak = true;
    if (own.s9_1) e.adMulFromClears = true;

    return e;
});

// めたん
/*
registerEffectProvider('metan', (state) => {
    return {
        zpsMul: 1,
        zdEffMul: 1,
        zpsExpAdd: 0,
        ascensionPowExp: 1,
        ipMul: 1,
        flags: { autoUnlocked: false },
        tabs: { edamame: false, automation: false },
        startBonuses: { anconity: { zd1: 0 } },
    };
});
*/

/*
// つむぎ
registerEffectProvider('tsumugi', (state) => {
    return {
        zpsMul: 1,
        zdEffMul: 1,
        zpsExpAdd: 0,
        ascensionPowExp: 1,
        ipMul: 1,
        flags: { autoUnlocked: false },
        tabs: { edamame: false, automation: false },
        startBonuses: { anconity: { zd1: 0 } },
    };
});
*/

// あんこチャレンジによる制約
function challengeEffectsLayer() {
    const e = {
        zpsExpAdd: 0,           // ZPSの指数加算
        zbCostMul: 1,         // ブーストのコスト
        zdEffMul: 1,           // 全ZD基礎倍率
        zbEffMul: 1,            // ブースト効力倍率
        zdCostPowAdd: 0,         // ZDコストの指数側に掛ける係数（ac5）
        edaUpgradeCostMul: 1,   // 枝豆アップグレードのコスト倍率(ac12)
        soyUpgradeCostMul: 1,   // 大豆アップグレードのコスト倍率(ac12)
    };

    if (!state.anko?.activeChal) return e;
    const idx = state.anko.activeChal;
    const t = ankoChalElapsedSec();

    switch (idx) {
        // ac1: ZD2～8=各1個まで（ガード側で設定）、ZPSが1.25乗
        case 1:
            e.zpsExpAdd += 0.25;
            break;

        // ac2: 全ZD効力 1/16、128秒ごとに×2
        case 2: {
            const steps = Math.floor(t / 128);
            const mul = (1 / 16) * Math.pow(2, steps);
            e.zdEffMul *= Math.max(mul, 1 / 16); // 下限担保
            break;
        }

        // ac3: アセンションごとに ZPS指数-0.005（下限0.01）
        case 3: {
            const dec = 0.005 * (state.anko.chalCounters.ascCount || 0);
            e.zpsExpAdd -= dec; // 最終で下限チェック
            break;
        }

        // ac4: ブースト1つあたり効力-30%
        case 4:
            e.zbEffMul *= 0.7;
            break;

        // ac5: ZD価格が2乗
        case 5:
            e.zdCostPowAdd += 1;
            break;

        // ac6: ZD1〜6しか買えない（ガード側で設定）
        case 6:
            break;

        // ac7: ZDを1買うごとに ZPS指数 -0.005（下限0.01）
        case 7: {
            const dec = 0.005 * (toNum(state.anko.chalCounters.totalDimBought) || 0);
            e.zpsExpAdd -= dec;
            break;
        }

        // ac8: ZD1〜7は各1個まで（→ガード側）
        case 8:
            break;

        // ac9: 16秒ごとにブースト価格×1.3
        case 9: {
            const steps = Math.floor(t / 16);
            e.zbCostMul = Math.pow(1.3, steps); // コスト式に組み込み
            break;
        }

        // ac10: プレステ禁止（→ガード側）、アセンション効力 3乗
        case 10:
            e.ascensionPowExp = (e.ascensionPowExp || 1) * 3;
            break;

        // ac11: プレステ回数が3の倍数でない時 ZPSを 0.5乗
        case 11:
            if ((state.anko.chalCounters.ascCount || 0) % 3 !== 0) {
                e.zpsExpAdd -= 0.5;
            }
            break;

        // ac12: ブースト購入不可（→ガード側）、枝豆/大豆UPGを安く
        case 12:
            e.edaUpgradeCostMul = (e.edaUpgradeCostMul || 1) * 0.5;
            e.soyUpgradeCostMul = (e.soyUpgradeCostMul || 1) * 0.8;
            break;

        // ac13: あんこディメンション効果を無効化
        case 13:
            e.ankoDimsDisabled = true;
            break;
    }

    return e;
}

function mergeEffects(base, add) {
    const out = JSON.parse(JSON.stringify(base));
    // 掛け算
    out.zpsMul *= (add.zpsMul ?? 1);
    out.zdEffMul *= (add.zdEffMul ?? 1);
    out.ascensionPowExp *= (add.ascensionPowExp ?? 1);
    out.apMul *= (add.apMul ?? 1);
    out.zbEffMul *= (add.zbEffMul ?? 1);
    out.zbCostMul *= (add.zbCostMul ?? 1);
    out.edaGetMul *= (add.edaGetMul ?? 1);
    out.ad1Mul *= (add.ad1Mul ?? 1);
    out.ad2Mul *= (add.ad2Mul ?? 1);
    out.edaUpgradeCostMul = (add.edaUpgradeCostMul ?? 1);
    out.soyUpgradeCostMul = (add.soyUpgradeCostMul ?? 1);
    // 足し算
    out.zdCostPowAdd += (add.zdCostPowAdd ?? 0);
    out.zpsExpAdd += (add.zpsExpAdd ?? 0);
    out.soyGetAdd += (add.soyGetAdd ?? 0);
    // OR
    out.flags.autoUnlocked ||= add.flags?.autoUnlocked ?? false;
    out.flags.anconityBreak ||= add.flags?.anconityBreak ?? false;
    out.flags.ankoDimsDisabled ||= add.flags?.ankoDimsDisabled ?? false;
    out.tabs.edamame ||= add.tabs?.edamame ?? false;
    out.tabs.automation ||= add.tabs?.automation ?? false;
    out.zd8EffMulByAmount ||= add.zd8EffMulByAmount ?? false;
    out.zdEffMulFromUnspentAP ||= add.zdEffMulFromUnspentAP ?? false;
    out.adMulFromClears ||= add.adMulFromClears ?? false;
    // 開始ボーナス
    const a0 = out.startBonuses.anconity, a1 = add.startBonuses?.anconity || {};
    a0.zd1 = Math.max(a0.zd1 ?? 0, a1.zd1 ?? 0);
    a0.zb += (a1.zb ?? 0);
    a0.cPre += (a1.cPre ?? 0);
    a0.zd2to6 = Math.max(a0.zd2to6 ?? 0, a1.zd2to6 ?? 0);

    // ZPS指数の下限処理（ac3/ac7）
    out.zpsExpAdd = Math.max(out.zpsExpAdd, -0.99);

    return out;
}

function recomputeAllSkillEffects() {
    let eff = JSON.parse(JSON.stringify(EFFECT_BASE));
    // あんこスキル
    for (const p of EffectProviders) {
        // 順番に依存しない寄与だけ返すので、ループ順は任意でOK
        const add = p.compute(state) || {};
        eff = mergeEffects(eff, add);
    }
    // あんこチャレンジ
    const ac = challengeEffectsLayer();
    eff = mergeEffects(eff, ac);
    state.effects = eff;
    applyOneShotUiFlags(eff);
}

function applyOneShotUiFlags(e) {
    // 自動化解放
    if (e.flags.autoUnlocked) {
        // 既にtrueならそのまま
        state.maxZunda = D(EDA_UNLOCK);
        checkAutomationUnlocks()
    }
    if (e.tabs.edamame) {
        edaUnlocked = true;
        setEdaButtonState()
    }
}

function getEffects() {
    return state.effects || EFFECT_BASE;  // 毎回これ経由で読む
}


/***** 4. MATH (PURE) *******************************************************/

/* ---- コスト基礎 ---- */
const baseCosts = [0, 10];
for (let i = 2; i <= 8; i++) {
    const prev = baseCosts[i - 1];
    let mult = 10; if (i === 3) mult = 1000; if (i === 4) mult = 10000; if (i === 5) mult = 100000; if (i === 6) mult = 1000000; if (i === 7) mult = 10000000; if (i === 8) mult = 100000000;
    baseCosts[i] = prev * mult;
}

/* Ascension計算 */
const ascSys = createAscensionSystem({
    getState: () => state,
    ASC_UNLOCK,
    D,
});

/* Prestige計算 */
const prestigeSystem = createPrestigeSystem({ toNum, log10Safe });
const prestigeRawLevelFromZ = prestigeSystem.prestigeRawLevelFromZ;

// スピードプレステージによる倍率取得
function getPrestigeSpeedMult() {
    if (state.prestige.speed > 0) {
        return Math.max(243, Math.pow(3, state.prestige.speed || 0));
    } else {
        return 1;
    }
}
function getPrestigeCostBase() { return 1.3; }
// パワープレステージによる係数・指数取得
function getPowerMult() {
    const lv = state.prestige?.power || 0;
    return 1 + Math.min(lv, 20) * 0.1;  // lv20で5.0倍、以降は増えない
}
function getPowerExp() {
    const lv = (state.prestige?.power) || 0;
    return Math.log10(10 + lv);
}
function getAscEffective() { return Math.max(state.ascensionMult, 1); }

/* ディメコスト緩和 */
const coefFor = i => {
    const lv = state.prestige.cost || 0;
    const innerExp = Math.max(0.25, 1.15 - lv * 0.015);
    return getPrestigeCostBase() * Math.pow(1.25, Math.pow(i - 1, innerExp));
};
function refreshCostMultipliers() { for (let i = 1; i <= 8; i++) { tiers[i].costMul = coefFor(i); } }

// ティア(ずんだディメンション)初期化
for (let i = 1; i <= 8; i++) {
    tiers[i] = {
        i,
        baseCost: baseCosts[i],
        costMul: coefFor(i),
        bought: D(0),
        generated: D(1),
        prodPerSec: i >= 2 ? 1 : 0,
        baseZps: i === 1 ? 1 : 0,
        revealed: false
    };
}

// 計算:ZD8専用のコスト計算式
function getZd8EffectiveBought(rawB) {
    const WALL_START = 70;
    const EXTRA_EXP = 1.25;

    const b = D(rawB || 0);
    if (b.lte(WALL_START)) return b;

    const over = b.sub(WALL_START);
    return over.pow(EXTRA_EXP).add(WALL_START);
}

// ZDコスト計算式
function costAt(t) {
    const ef = (typeof getEffects === 'function' ? getEffects() : {}) || {};
    const p = D(1).add(ef.zdCostPowAdd || 0);        // p = 1 + zdCostPowAdd
    const a = D(t.baseCost);
    const r = D(t.costMul);
    let b = D(t.bought || D(0));

    if (t.i === 8) {
        b = getZd8EffectiveBought(b);
    }

    return a.mul(r.pow(b)).pow(p);
}

// ZDまとめ買いコスト計算式
function totalCost(t, n) {
    if (n <= 0) return D(0);

    const ef = (typeof getEffects === 'function' ? getEffects() : {}) || {};
    const p = D(1).add(ef.zdCostPowAdd || 0);        // p = 1 + zdCostPowAdd
    const a = D(t.baseCost);
    const r = D(t.costMul);
    const baseBought = D(t.bought || D(0));

    // ZD8 以外は今まで通り等比数列でOK
    if (t.i !== 8) {
        const aPow = a.pow(p);
        const rPow = r.pow(p);
        const first = aPow.mul(rPow.pow(baseBought));

        if (rPow.eq(1)) {
            return first.mul(n);
        } else {
            return first.mul(rPow.pow(n).sub(1)).div(rPow.sub(1));
        }
    }

    // ZD8 だけは1個ずつコストを積み上げる
    let sum = D(0);
    for (let k = 0; k < n; k++) {
        const rawB = baseBought.add(k);
        const effB = getZd8EffectiveBought(rawB);
        const cost = a.mul(r.pow(effB)).pow(p);
        sum = sum.add(cost);
    }
    return sum;
}

function maxAffordable(t) {
    let lo = 0, hi = 1;
    while (totalCost(t, hi).lte(state.zunda)) hi *= 2;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (totalCost(t, mid).lte(state.zunda)) lo = mid; else hi = mid - 1;
    }
    return lo;
}

/* ---- Boost ---- */
const BOOST_BASE_COST = D(10), BOOST_STEP = D(10), BOOST_PER_LV = 0.0825;
// 計算:ブースト1個あたりの倍率
function getBoostPerItem() {
    const upPer = BOOST_PER_LV * getEffects().zbEffMul;
    const base = D(1).plus(upPer);                          // 1 + 0.0825*1.2
    const soyUp = D(1.01).pow(state.soy.boostUpLv || 0);         // 大豆による強化
    return base.mul(soyUp);                                         // Decimalを返す
}
function boostTotal() { return state.boostZunda.add(state.boostEdamame).add(state.boostOther); }
function getBoostMult() {
    const per = D(getBoostPerItem());
    const total = D(boostTotal());
    return per.pow(total); // Decimal
}
const zundaBoostCost = () => BOOST_BASE_COST.mul(BOOST_STEP.pow(state.boostZunda));
function zundaBoostTotal(n) {
    if (n <= 0) return D(0);
    const a = zundaBoostCost(); const r = BOOST_STEP;
    if (r.eq(1)) return a.mul(n);
    return a.mul(r.pow(n).sub(1)).div(r.sub(1));
}
function maxBoostAffordableZunda() {
    if (!canUseBoost()) return 0;
    let lo = 0, hi = 1;
    while (zundaBoostTotal(hi).lte(state.zunda)) hi *= 2;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (zundaBoostTotal(mid).lte(state.zunda)) lo = mid; else hi = mid - 1;
    }
    return lo;
}

/* ---- Ascension ---- */
// 計算:ソフトキャップ
function softcapMul(x, T, gamma) {
    if (x <= T) return x;
    const rt = T * Math.pow(x / T, gamma); // 0 < gamma < 1 で緩やかに
    if (rt <= T) return T;
    return rt;
}

// 計算:アセンション実効倍率
function ascNewMultFrom(z) { // z: Decimal
    if (z.lt(D('1e16'))) return 1;
    const lg = z.log10();
    const raw = Math.pow(Math.pow(getPowerMult() * Math.pow(4, 1 + (lg - 16) / 16), getEffects().ascensionPowExp), getPowerExp());
    // ── ここからソフトキャップ ──
    const T1 = 2_000_000, G1 = 0.7;     // 200万超でやや緩め
    const T2 = 100_000_000, G2 = 0.35; // 1億超でさらに緩く
    let m = softcapMul(raw, T1, G1);
    m = softcapMul(m, T2, G2);
    if (state?.anko?.activeChal) {
        if (state.anko.activeChal == 10) m = softcapMul(raw, T1, 0.5);
    }
    return m;
}

/* ---- 枝豆／大豆（基礎はNumberのまま。必要ならDecimal化拡張できる） ---- */
const EDA_BOOST_BASE = 10, EDA_BOOST_STEP = 1.5;
const EDA_EXP_BASE = 2000, EDA_EXP_STEP = 2.25, EDA_EXP_PER = 0.01;
function edaBoostCost() { return Math.ceil(EDA_BOOST_BASE * getEffects().edaUpgradeCostMul * Math.pow(Math.max(EDA_BOOST_STEP * getEffects().edaUpgradeCostMul, 1.125), state.eda.boostBought || 0)); }
function edaBoostTotal(n) { if (n <= 0) return 0; const a = EDA_BOOST_BASE * getEffects().edaUpgradeCostMul * Math.pow(Math.max(EDA_BOOST_STEP * getEffects().edaUpgradeCostMul, 1.125), state.eda.boostBought || 0), r = Math.max(EDA_BOOST_STEP * getEffects().edaUpgradeCostMul, 1.125); return Math.ceil(r === 1 ? a * n : a * (Math.pow(r, n) - 1) / (r - 1)); }
function edaExpCost() { return Math.ceil(EDA_EXP_BASE * getEffects().edaUpgradeCostMul * Math.pow(EDA_EXP_STEP * getEffects().edaUpgradeCostMul, state.eda.expBought || 0)); }
function edaExpTotal(n) { if (n <= 0) return 0; const a = EDA_EXP_BASE * getEffects().edaUpgradeCostMul * Math.pow(EDA_EXP_STEP * getEffects().edaUpgradeCostMul, state.eda.expBought || 0), r = EDA_EXP_STEP * getEffects().edaUpgradeCostMul; return Math.ceil(r === 1 ? a * n : a * (Math.pow(r, n) - 1) / (r - 1)); }
function maxAffordableByEdamame(totalFn) {
    let lo = 0, hi = 1; while (totalFn(hi) <= state.eda.amount) hi *= 2;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (totalFn(mid) <= state.eda.amount) lo = mid; else hi = mid - 1; }
    return lo;
}

/* 大豆 */
const SOY_K = 0.01, SOY_N0 = 600, SOY_H = 250, SOY_P = 1.10;
function calcSoyPS() {
    // ZD8 の購入数
    const z = (tiers?.[8]?.bought) || D(0);

    // 立ち上がり：80あたりからグッと伸び、以後は緩やか
    const k = 0.04;   // 立ち上がりの鋭さ
    const beta = 0.8; // 伸びの緩さ（全体のルートっぽい圧縮）

    const core = Math.log(1 + Math.exp(k * (z - 80))) / Math.log(2); // log2(1+exp(…))
    const sps = Math.pow(core, beta) + getEffects().soyGetAdd;
    return Number.isFinite(sps) && sps > 0 ? sps : 0;
}
const SOY_BOOSTUP_BASE = 200, SOY_BOOSTUP_STEP = 2;
const SOY_ZD8_BASE = 150, SOY_ZD8_STEP = 1.5;
function soyBoostUpCost() { return Math.ceil(SOY_BOOSTUP_BASE * getEffects().soyUpgradeCostMul * Math.pow(SOY_BOOSTUP_STEP * getEffects().soyUpgradeCostMul, state.soy.boostUpLv || 0)); }
function soyBoostUpTotal(n) { if (n <= 0) return 0; const a = SOY_BOOSTUP_BASE * getEffects().soyUpgradeCostMul * Math.pow(SOY_BOOSTUP_STEP * getEffects().soyUpgradeCostMul, state.soy.boostUpLv || 0), r = SOY_BOOSTUP_STEP * getEffects().soyUpgradeCostMul; return Math.ceil(r === 1 ? a * n : a * (Math.pow(r, n) - 1) / (r - 1)); }
function getZdMultFromUnspentAp() {
    if (getEffects().zdEffMulFromUnspentAP) {
        const ap = state.ap || 0;

        if (ap <= 0) return 1;

        // 1 + 8.3 × log10( log10(AP + 10) + 1 )
        const inner = Math.log10(ap + 10);
        const outer = Math.log10(inner + 1);
        const mult = 4 + 8.3 * outer;

        return mult;
    } else {
        return 1;
    }
}

function soyZd8Cost() {
    const mul = Math.max(SOY_ZD8_STEP * getEffects().soyUpgradeCostMul, 1.05);
    return Math.ceil(SOY_ZD8_BASE * getEffects().soyUpgradeCostMul * Math.pow(mul, state.soy.zd8Lv || 0));
}
function soyZd8Total(n) {
    if (n <= 0) return 0;

    const mul = Math.max(SOY_ZD8_STEP * getEffects().soyUpgradeCostMul, 1.05);
    const a = SOY_ZD8_BASE * getEffects().soyUpgradeCostMul * Math.pow(mul, state.soy.zd8Lv || 0);

    return Math.ceil(mul === 1 ? a * n : a * (Math.pow(mul, n) - 1) / (mul - 1));
}
function getZd8Mult() {
    let zd8EffMulByAm = 1;
    if (getEffects().zd8EffMulByAmount) {
        zd8EffMulByAm = 1 + tiers[8].bought.div(D(25));
    }
    return Math.pow(3, state.soy.zd8Lv || 0) * zd8EffMulByAm;
}

/* ---- ZPS ---- */
// 計算:基礎ZPS
function baseZpsOnly() {
    const ankoMult = getAnkoZundaMult();
    const b = D(tiers[1].baseZps)
        .mul(tiers[1].bought)
        .mul(tiers[1].generated)
        .mul(getBoostMult())            // Decimal
        .mul(getAscEffective())         // Number
        .mul(getPrestigeSpeedMult())    // Number
        .mul(state.effects.zpsMul)
        .mul(state.effects.zdEffMul)
        .mul(getZdMultFromUnspentAp())
        .mul(ankoMult)
        .mul(getAnkoDimClearMult());
    return b; // Decimal
}
// 計算:ZPS指数
function getExpAdd() {
    const exp = D(0)
        .add((state.eda.expBought || 0) * EDA_EXP_PER)
        .add(getEffects().zpsExpAdd);
    return exp;
}
// 計算:実効ZPS
function effectiveZps() {
    const base = baseZpsOnly();
    if (base.lte(0)) return D(0);
    const baseExp = D(1);        // 基本指数
    const addExp = getExpAdd(); // ±調整値（通常0）

    const exp = baseExp.add(addExp).max(0.01);
    return base.pow(exp);
}

function getAnkoDimClearMult() {
    if (getEffects().adMulFromClears == false) return 1;
    const clears = state.ankonityClears || 0;
    if (clears <= 0) return 1;

    const inner = Math.log10(clears + 1);
    const mult = 1 + 0.1858961300583371 * Math.pow(inner, 4);
    return mult;
}

function getAnkoZundaMult() {
    // 全ずんだディメンションの効率に “あんこ量^0.5” を掛ける（最低1）
    const a = state.anko?.amount instanceof Decimal ? state.anko.amount : D(state.anko?.amount || 0);
    if (a.lte(0)) return 1;
    const m = a.pow(0.5); // Decimal
    const n = toNum(m);
    return Number.isFinite(n) ? Math.max(1, n) : 1;
}

function adCostAt(i) {
    const d = state.anko.dims[i];
    return calcAdCost(i, d?.bought);
}


/***** 5. ACTIONS (SIDE EFFECTS) ********************************************/

function flashSaveStatus(t) {
    const e = el('saveStatus'); if (!e) return;
    e.textContent = t; e.style.opacity = '1';
    clearTimeout(flashSaveStatus._t);
    flashSaveStatus._t = setTimeout(() => { e.style.opacity = '.8'; }, 1200);
}

// ずんだディメンション購入可能判定(ac1,8,6)
function canBuyZundaDimension(i) {
    let ok = true;

    if (isChal(1) && i >= 2 && i <= 8) {
        if ((state.anko.chalCounters.perDimOwned[i] || 0) >= 1) ok = false;
    }
    if (isChal(8) && i >= 1 && i <= 7) {
        if ((state.anko.chalCounters.perDimOwned[i] || 0) >= 1) ok = false;
    }
    if (isChal(6) && i > 6) ok = false; // ac6: 1〜6のみ

    return ok;
}

// ずんだディメンション購入時のカウント
function onBuyZundaDimension(i, count = 1) {
    // 実際の購入成功後に呼ばれる
    state.anko.chalCounters.perDimOwned[i] = (state.anko.chalCounters.perDimOwned[i] || 0) + count;
    state.anko.chalCounters.totalDimBought = (state.anko.chalCounters.totalDimBought || D(0)).add(count); // ac7
    recomputeAllSkillEffects();
}

// ずんだディメンション購入
function buy(t, n) {
    // チャレンジの内容に応じて購入数をクランプ
    let i = t.i | 0, owned = state.anko.chalCounters.perDimOwned[i] || 0;
    if (isChal(1) && i >= 2 && i <= 8) n = Math.min(n, Math.max(0, 1 - owned));
    if (isChal(8) && i >= 1 && i <= 7) n = Math.min(n, Math.max(0, 1 - owned));
    if (isChal(6) && i > 6) return false;

    if (state.anconityReady) return false;
    const c = totalCost(t, n);
    if (c.gt(state.zunda)) return false;
    if (!canBuyZundaDimension(t.i)) return false;
    state.zunda = state.zunda.sub(c);
    t.bought = D(t.bought).add(n);
    return true;
}

/* 一周で何も買えなくなるまで、ブースト→ZD8..1 を1個ずつ買い続ける */
function buyAllMax() {
    let didBuy = false;
    // 無限ループ防止の上限（理論上は早く止まる）
    for (let guard = 0; guard < 10000; guard++) {
        const boughtThisPass = buyRoundRobinOnce();
        if (!boughtThisPass) break;
        didBuy = true;
    }
    if (didBuy) {
        updateUI();
    }
}
/* 1個購入ごとに枝豆を加算（アンロック後のみ） */
function incEdamame(n) {
    if (!edaUnlocked || !n) return;
    const add = (typeof D === 'function') ? D(n) : n;
    if (state.eda && state.eda.amount && typeof state.eda.amount.add === 'function') {
        state.eda.amount = state.eda.amount.add(add);
    } else {
        state.eda.amount += n * (getEffects().edaGetMul ?? 1);
    }
}
/* ブースト → ZD8 → … → ZD1 の順で 1個ずつだけ買う。買えたら true を返す */
function buyRoundRobinOnce() {
    // まずブーストを 1個（解禁＆資金が足りれば）
    if (typeof maxBoostAffordableZunda === 'function' && typeof buyBoostMany === 'function' && typeof canUseBoost === 'function') {
        if (canUseBoost() && canBuyBoost()) {
            const m = maxBoostAffordableZunda();
            if (m >= 1) { buyBoostMany(1); return true; }
        }
    }

    // 次に ZD8 → … → ZD1 を 1個だけ買う
    for (let i = 8; i >= 1; i--) {
        const t = tiers[i];
        if (!t) continue;
        // 1個だけ試し買い。成功したら枝豆+1（アンロック時）
        if (buy(t, 1)) { incEdamame(1); onBuyZundaDimension(i, 1); return true; }
    }
    return false;
}


// 自動アセンションの実行倍率取得
function getAutoAscMul() {
    const raw = state.auto.ascMul ?? "1";
    try {
        return D(raw); // 1e10 → 正しく 1e10 として解釈
    } catch {
        return D(1); // fallback
    }
}

// アセンション自動実行
function maybeAutoAscend() {
    if (!state.auto?.unlocked?.asc) return false;
    if (!state.auto?.enabled?.asc) return false;
    if (!ascSys.canAscend()) return false;

    const mul = getAutoAscMul();           // 入力欄の指定倍率（Decimal）
    const m = mul.lt(1) ? D(1) : mul;  // 念のため1未満は1に丸め

    const nowRaw = Math.max(state.ascensionMult, 1);                     // 現在のアセンション倍率
    const nextRaw = ascNewMultFrom(Decimal.max(state.zunda, D(1)));       // 実行後の倍率

    const nowD = D(nowRaw);
    const nextD = D(nextRaw);

    // 実行後倍率 >= 現在倍率 × 指定倍率 になったら実行
    if (nextD.gte(nowD.mul(m))) {
        doAscend();
        return true;
    }
    return false;
}

// プレステージ自動実行用：指定レベル差の取得
function getAutoPrestDelta(which) {
    const FALLBACK = 4;
    if (!state.auto || !state.auto.prestMul) return FALLBACK;

    const raw = state.auto.prestMul[which];

    if (raw == null || raw === "") return FALLBACK;

    if (typeof raw === "number") {
        const n = Math.floor(raw);
        return n >= 1 ? n : FALLBACK;
    }

    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return FALLBACK;

    return Math.floor(n);
}

// プレステージ自動実行
function maybeAutoPrestige() {
    if (!state.auto?.unlocked?.prest) return false;
    if (!canDoPrestige()) return false;
    if (!state.zunda.gte(PRESTIGE_UNLOCK)) return false;

    // 今のずんだ量から「到達可能なプレステージレベル」を計算
    const calc = prestigeRawLevelFromZ(state.zunda);
    if (!(calc > 0)) return false;

    const types = ['speed', 'power', 'cost'];

    let bestType = null;
    let bestTarget = Infinity;

    for (const key of types) {
        // 自動化がONじゃないものはスキップ
        if (!state.auto?.enabled?.prest?.[key]) continue;

        const cur = state.prestige?.[key] || 0;      // 現在レベル
        const delta = getAutoPrestDelta(key);          // UI で指定したレベル差
        if (delta <= 0) continue;

        const target = cur + delta;                    // 目標レベル

        // 到達可能かつ、目標レベルが一番低いものを採用
        if (calc >= target && target < bestTarget) {
            bestTarget = target;
            bestType = key;
        }
    }

    if (bestType) {
        doPrestige(bestType);
        return true;
    }
    return false;
}

// 低速自動購入(8秒に一回)
function automationTick() {
    if (state.anconityReady) return; // 停止中は何もしない
    if (state.auto.enabled.boost && state.auto.unlocked.boost && !state.auto?.unlocked?.boostFast) {
        const m = maxBoostAffordableZunda();
        if (m > 0 && canBuyBoost()) buyBoostMany(m);
    }
    for (let i = 1; i <= 8; i++) {
        if (state.auto.enabled.zd[i - 1] && state.auto.unlocked.zd[i - 1] && !state.auto.unlocked.zdFast[i - 1]) {
            const n = maxAffordable(tiers[i]);
            if (n > 0) {
                if (buy(tiers[i], n)) {
                    onBuyZundaDimension(i, n);
                    if (edaUnlocked) {
                        state.eda.amount += n * (getEffects().edaGetMul ?? 1);
                    }
                }
            }
        }
    }
    updateUI();
}

// 高速自動購入
function runFastAutomation() {
    // 1. ブースト：高速ONなら毎フレームMax購入
    if (state.auto.unlocked.boost && state.auto.unlocked.boostFast && state.auto.enabled.boostFast) {
        const m = maxBoostAffordableZunda(); if (m > 0 && canBuyBoost()) buyBoostMany(m);
    }

    // 2. ZD1..8：高速ONのものは毎フレームMax購入
    for (let i = 1; i <= 8; i++) {
        if (!state.auto.unlocked.zd[i - 1]) continue;             // そもそも未解禁なら対象外
        if (!state.auto.unlocked.zdFast[i - 1]) continue;         // 高速未解禁なら対象外
        if (!state.auto.enabled.zdFast[i - 1]) continue;         // 高速スイッチOFFなら対象外

        const n = maxAffordable(tiers[i]);
        if (n > 0) {
            if (buy(tiers[i], n)) {
                onBuyZundaDimension(i, n);
                if (edaUnlocked) {
                    state.eda.amount += n * (getEffects().edaGetMul ?? 1);
                }
            }
        }
    }

    // 3. プレステージ（スピード/パワー/コストの中で目標レベルが一番低いものを優先）
    if (maybeAutoPrestige()) return;

    // 4. アセンション（現在倍率 × 指定倍率 を超えたら）
    if (maybeAutoAscend()) return;
}

// ずんだブースト購入可能判定(ac12)
function canBuyBoost() {
    if (isChal(12)) return false;
    return true;
}

// ずんだプレステージ購入可能判定(ac10)
function canDoPrestige() {
    if (isChal(10)) return false;
    return true;
}

// アセンション実行
function doAscend() {
    if (!ascSys.canAscend()) { alert("アセンションの解禁条件を満たしていません。（必要：ずんだ ≥ 1e16）"); return; }
    const nextMult = ascNewMultFrom(state.zunda);
    if (nextMult <= state.ascensionMult) { alert("現在のアセンション倍率以下のため、実行できません。"); return; }
    state.ascensionMult = nextMult;

    state.zunda = D(10); state.boostZunda = D(0);
    for (let i = 1; i <= 8; i++) { tiers[i].bought = D(0); tiers[i].generated = D(1); if (i >= 2) tiers[i].revealed = false; }
    for (let i = 2; i <= 8; i++) { const row = el(`row-zd${i}`); if (row) row.style.display = "none"; }

    // あんこチャレンジ用
    state.anko.chalCounters.ascCount = (state.anko.chalCounters.ascCount || 0) + 1;
    for (let i = 1; i <= 8; i++) {
        state.anko.chalCounters.perDimOwned[i] = 0;
    }
    if (isChal(5)) {
        state.zunda = D(100);
    }

    recomputeAllSkillEffects();
    refreshCostMultipliers();
    markPrestigeDirty();
    updateUI(); save();
}
// プレステージ実行
function doPrestige(which) {
    if (!canDoPrestige()) return;
    const cur = state.prestige[which] || 0;
    const calc = prestigeRawLevelFromZ(state.zunda);
    if (!(calc > cur && state.zunda.gte(PRESTIGE_UNLOCK))) return false;
    state.prestige[which] = calc;

    state.zunda = D(10); state.boostZunda = D(0); state.ascensionMult = 1;
    for (let i = 1; i <= 8; i++) { tiers[i].bought = D(0); tiers[i].generated = D(1); if (i >= 2) tiers[i].revealed = false; }
    refreshCostMultipliers();
    for (let i = 2; i <= 8; i++) { const row = el(`row-zd${i}`); if (row) row.style.display = "none"; }

    // あんこチャレンジ用
    for (let i = 1; i <= 8; i++) {
        state.anko.chalCounters.perDimOwned[i] = 0;
    }
    if (isChal(5)) {
        state.zunda = D(100);
    }

    recomputeAllSkillEffects();
    markPrestigeDirty();
    updateUI(); save(); return true;
}

/* ---- Boost ---- */
// ブースト解禁済みか
const canUseBoost = () => state.zunda.gte(BOOST_UNLOCK);
// ブースト購入
function tryBuyBoost() {
    if (!canBuyBoost()) return false;
    if (state.anconityReady) return false;
    if (!canUseBoost()) { alert("まだブーストは解禁されていません。（必要：ずんだ ≥ 1e10）"); return; }
    const cost = zundaBoostCost();
    if (state.zunda.lt(cost)) { alert("ずんだが足りません！"); return; }
    state.zunda = state.zunda.sub(cost);
    state.boostZunda = state.boostZunda.add(1);
    updateUI();
}
// ブースト最大購入
function buyBoostMany(n) {
    if (state.anconityReady) return false;
    if (n <= 0 || !canUseBoost()) return false;
    const cost = zundaBoostTotal(n);
    if (state.zunda.lt(cost)) return false;
    state.zunda = state.zunda.sub(cost);
    state.boostZunda = state.boostZunda.add(n);
    updateUI();
    return true;
}

/* ---- 枝豆/大豆 解禁監視 ---- */
function checkEdaSubtabProgress() {
    if (!edaUnlocked && !edaHintShown && state.zunda.gte('1e100')) {
        edaHintShown = true;
        setEdaButtonState();
    }
    if (!edaUnlocked && state.zunda.gte(EDA_UNLOCK)) {
        edaUnlocked = true;
        try { localStorage.setItem(EDA_UNLOCK_KEY, JSON.stringify(true)); } catch (e) { }
        setEdaButtonState();
        const vz = document.getElementById('z-sub-zd');
        const ve = document.getElementById('z-sub-eda');
        if (vz) vz.classList.add('active');
        if (ve) ve.classList.remove('active');
    }
}

// 進行状況監視
function evaluateZundaProgress() {
    if (!Number.isFinite(state.zundaProgress)) {
        state.zundaProgress = 0;
    }

    const oldP = state.zundaProgress;
    let best = state.zundaProgress;

    if (state.zunda.gte(D('0'))) best = Math.max(best, 1);
    if (state.zunda.lte(D('1'))) best = Math.max(best, 2);
    if (state.zunda.gte(D('100'))) best = Math.max(best, 3);
    if (D(tiers[2].bought).gte(D('1'))) best = Math.max(best, 4);
    if (state.zunda.gte(D('1e9'))) best = Math.max(best, 5);
    if (state.zunda.gte(D(BOOST_UNLOCK))) best = Math.max(best, 6);
    if (state.zunda.gte(D(ASC_UNLOCK))) best = Math.max(best, 7);
    if ((state.ascensionMult ?? 1) > 1) best = Math.max(best, 8);
    if (state.zunda.gte(D('1e16')) && (state.ascensionMult ?? 1) > 1) best = Math.max(best, 9);
    if (state.zunda.gte(D('1e35'))) best = Math.max(best, 10);
    if (state.zunda.gte(D(PRESTIGE_UNLOCK))) best = Math.max(best, 11);
    if (best == 11 && state.zunda.lte(D('20')) && (state.prestige.power > 0 || state.prestige.cost > 0)) best = Math.max(best, 12);
    if ((best == 11 || best == 12) && state.prestige.speed > 0) best = Math.max(best, 13);
    if ((best == 12 || best == 13) && state.zunda.gte(D('1e9'))) best = Math.max(best, 14);
    if (best > 11 && state.zunda.gte(D('1e68'))) best = Math.max(best, 15);
    if (best == 15 && (state.zunda.gte(D('1e75') || state.zunda.lte(D('100'))))) best = Math.max(best, 16);
    if (state.zunda.gte(D(EDA_UNLOCK))) best = Math.max(best, 17);
    if (best == 17 && (state.zunda.gte(D('1e170') || state.zunda.lte(D('100'))))) best = Math.max(best, 18);
    if (state.zunda.gte(D('1e200'))) best = Math.max(best, 19);
    if (best == 19 && state.zunda.lte(D('100'))) best = Math.max(best, 20);
    if (state.zunda.gte(D('1e250'))) best = Math.max(best, 21);
    if (best == 21 && state.zunda.lte(D('100'))) best = Math.max(best, 22);
    if (state.zunda.gte(D('1e275'))) best = Math.max(best, 23);
    if (best == 23 && state.zunda.lte(D('100'))) best = Math.max(best, 24);
    if (state.zunda.gte(D('1e300'))) best = Math.max(best, 25);
    if (best == 25 && state.zunda.lte(D('100'))) best = Math.max(best, 26);
    if (state.anconityReady) best = Math.max(best, 27);
    if (best == 27 && state.zunda.lte(D('100'))) best = Math.max(best, 28);
    if (state.anconityClears > 0) best = Math.max(best, 29);
    if ((best == 29 && state.zunda.gt(D('10'))) || state.anconityClears > 1) best = Math.max(best, 30);

    if (best != oldP) {
        state.zundaProgress = best;
        Bubble.enqueueTutorialForProgress(best);

        // 進行度アップ時は即表示
        Bubble.showNextZundaLine();
    }
}

// アンコニティ待機状態にする
function setAnconityReady(on) {
    state.anconityReady = !!on;
    const bar = document.getElementById('anconityBar');
    if (bar) bar.style.display = on ? 'block' : 'none';
}

// アンコニティ可能か判断
function checkAnconity() {
    // 既に準備完了なら上限で固定
    if (state.anconityReady) {
        state.zunda = Decimal.min(state.zunda, INF);
        return;
    }
    // 閾値到達でフラグON＋固定
    if (state.zunda.gte(INF)) {
        state.zunda = INF;
        setAnconityReady(true);
    }
}

const ANKO_SHAKE_MS = 800;     // 震え終わり
const ANKO_PARTICLE_MS = 900;  // パーティクル寿命

// アンコニティ時のパーティクル演出
function ankoShakeAndParticles(btn, onDone) {
    if (!btn) return;

    btn.classList.remove('anko-shake');
    void btn.offsetWidth;
    btn.classList.add('anko-shake');

    setTimeout(() => {
        // 茶系＋金系パレット
        const colors = ['#8c5c33', '#b58863', '#e0c097', '#fff2d8', '#ffddbb', '#ffd7a3', '#ffcf7f'];
        const N = 120; // パーティクル数増量
        const spread = 220; // 飛び散る半径（以前は約60）
        const heightBoost = 0; // 上方向への飛距離強化

        for (let i = 0; i < N; i++) {
            const s = document.createElement('span');
            s.className = 'anko-particle';
            s.style.background = colors[i % colors.length];

            // ランダムな方向に散らばる
            const angle = Math.random() * Math.PI * 2;
            const r = spread * (0.5 + Math.random() * 0.5);
            const dx = Math.cos(angle) * r + (Math.random() * 40 - 20);
            const dy = Math.sin(angle) * r - heightBoost * Math.random();

            s.style.setProperty('--dx', dx + 'px');
            s.style.setProperty('--dy', dy + 'px');
            s.style.left = '50%';
            s.style.top = '50%';
            s.style.transform = 'translate(-50%,-50%)';

            btn.appendChild(s);
            setTimeout(() => s.remove(), 1300);
        }

        // パーティクルが消えた後に実行
        setTimeout(() => { if (onDone) onDone(); }, 1100);
    }, 800); // 震え後
}

// アンコニティ時にもろもろをリセット
function applyAnconityResetLocks() {
    // ずんだ系の到達値をリセット
    state.maxZunda = D(EDA_UNLOCK);

    if (!getEffects().tabs.automation) {
        // ── 自動化を再ロック ──
        if (state.auto?.unlocked) {
            state.auto.unlocked.boost = false;
            state.auto.unlocked.zd = Array(8).fill(false);
        }

    }

    if (!getEffects().tabs.edamame) {
        // ── 枝豆タブを再ロック ──
        // 表示中のサブタブをZUNDA側に戻す
        const vz = document.getElementById('z-sub-zd');
        const ve = document.getElementById('z-sub-eda');
        if (vz) { vz.style.display = 'block'; vz.classList.add('active'); }
        if (ve) { ve.style.display = 'none'; ve.classList.remove('active'); }

        // 実際の解禁フラグを戻す（恒久記録もfalseに上書き）
        edaUnlocked = false;
        try { localStorage.setItem(EDA_UNLOCK_KEY, JSON.stringify(false)); } catch (e) { }

        setEdaButtonState(); // ボタン文言と状態の再描画

        // ずんだ系の到達値をリセット
        state.maxZunda = D(10);

    }

    // UI更新 & セーブ
    updateUI();
    save();
}

// アンコニティ実行
function doAnconityExecute() {

    ankoChalLogic.completeAnkoChallenge()
    // AP +1
    const apMul = D(getEffects().apMul || 1);
    state.ap = D(state.ap || 0).add(apMul); // AP + apMul
    state.anconityClears = (state.anconityClears || 0) + 1;

    // ずんだ/ブースト/アセン/プレステージ/枝豆/大豆/あんこディメンションを初期化
    state.zunda = D(10);
    state.boostZunda = D(0);
    state.boostEdamame = D(0);
    state.boostOther = D(0).add(getEffects().startBonuses.anconity.zb);
    state.ascensionMult = 1;
    state.prestige = { speed: 0, power: 0, cost: 0 + getEffects().startBonuses.anconity.cPre };
    state.eda = { amount: 0, boostBought: 0, expBought: 0 };
    state.soy = { amount: 0, boostUpLv: 0, zd8Lv: 0 };
    state.anko.amount = D(0);

    // ディメンション
    for (let i = 1; i <= 8; i++) {
        tiers[i].bought = D(0);
        tiers[i].generated = D(1);
        if (i >= 2) tiers[i].revealed = false;

        // あんこ
        state.anko.dims[i].generated = D(1);
    }

    if (getEffects().startBonuses.anconity.zd1) {
        state.maxZunda = D(EDA_UNLOCK);
        tiers[1].bought = D(10);
        tiers[2].revealed = true;
    } else {
        // 最大到達等
        state.maxZunda = D(10);
    }

    // s7_1の効果
    if (getEffects().startBonuses.anconity.zd2to6) {
        for (let i = 2; i <= 6; i++) {
            tiers[i].bought = D(1);
            tiers[i].revealed = true;
        }
        tiers[7].revealed = true;
    }

    refreshCostMultipliers();

    // アンコフラグ解除
    state.anconityReady = false;

    // あんこタブ解放
    state.ankoTabUnlocked = true;
    const ta = document.getElementById('tab-anko');
    if (ta) ta.style.display = 'block';

    // UI反映
    const bar = document.getElementById('anconityBar');
    if (bar) bar.style.display = 'none';
    const apEl = document.getElementById('apAmount');
    if (apEl) apEl.textContent = state.ap.toString();

    if (window.updateAskillStates) askill.updateAskillStates();

    // ZUNDA行の可視制御を初期化
    for (let i = 2; i <= 8; i++) {
        const row = document.getElementById(`row-zd${i}`);
        if (row) row.style.display = "none";
    }

    // ロック類をリセット
    applyAnconityResetLocks();

    // 効果の再計算
    recomputeAllSkillEffects();
    markPrestigeDirty();

    setAnconityReady(false);
    updateUI();
    save();
}

// アンコニティ時と同じリセット(AP入手なし)
function doAnconityReset() {

    // ずんだ/ブースト/アセン/プレステージ/枝豆/大豆/あんこディメンションを初期化
    state.zunda = D(10);
    state.boostZunda = D(0);
    state.boostEdamame = D(0);
    state.boostOther = D(0).add(getEffects().startBonuses.anconity.zb);
    state.ascensionMult = 1;
    state.prestige = { speed: 0, power: 0, cost: 0 + getEffects().startBonuses.anconity.cPre };
    state.eda = { amount: 0, boostBought: 0, expBought: 0 };
    state.soy = { amount: 0, boostUpLv: 0, zd8Lv: 0 };
    state.anko.amount = 0;

    // ディメンション
    for (let i = 1; i <= 8; i++) {
        tiers[i].bought = D(0);
        tiers[i].generated = D(1);
        if (i >= 2) tiers[i].revealed = false;

        // あんこ
        state.anko.dims[i].generated = D(1);
    }

    if (getEffects().startBonuses.anconity.zd1) {
        state.maxZunda = D(EDA_UNLOCK);
        tiers[1].bought = D(10);
        tiers[2].revealed = true;
    } else {
        // 最大到達等
        state.maxZunda = D(10);
    }

    // s7_1の効果
    if (getEffects().startBonuses.anconity.zd2to6) {
        for (let i = 2; i <= 6; i++) {
            tiers[i].bought = D(1);
            tiers[i].revealed = true;
        }
        tiers[7].revealed = true;
    }

    refreshCostMultipliers();

    // アンコフラグ解除
    state.anconityReady = false;

    // UI反映
    const bar = document.getElementById('anconityBar');
    if (bar) bar.style.display = 'none';
    const apEl = document.getElementById('apAmount');
    if (apEl) apEl.textContent = state.ap.toString();

    if (window.updateAskillStates) askill.updateAskillStates();

    // ZUNDA行の可視制御を初期化
    for (let i = 2; i <= 8; i++) {
        const row = document.getElementById(`row-zd${i}`);
        if (row) row.style.display = "none";
    }

    // ロック類をリセット
    applyAnconityResetLocks();

    // 効果の再計算
    recomputeAllSkillEffects();
    markPrestigeDirty();

    setAnconityReady(false);
    updateUI();
    save();
}

// あんこチャレンジ報酬
function grantAnkoChallengeReward(idx) {
    const au = state.auto?.unlocked; if (!au) return;

    if (idx >= 1 && idx <= 8) {
        if (au.zdFast[idx - 1] == true) return;
        // ZD1..8 の高速自動購入解禁
        au.zdFast[idx - 1] = true;
    } else {
        switch (idx) {
            case 9: if (au.boostFast == true) return; au.boostFast = true; break; // ブースト高速自動
            case 10: if (au.asc == true) return; au.asc = true; break; // アセンション自動実行
            case 11: if (au.prest == true) return; au.prest = true; break; // プレステージ自動実行
            case 12: if (au.eda == true) return; au.eda = true; au.soy = true; break; // 枝豆UG自動購入
            case 13: if (au.anco == true) return; au.anco = true; break; // アンコニティ自動実行
        }
    }

    markAutomationDirty();
    automationUI.refreshIfDirty(); // UIに「解禁済」をすぐ反映
}

/* ---- あんこディメンション ---- */
// 購入可能か判定
function canBuyAD(i) {
    const bought = state.anko.dims[i].bought;
    return canAffordAd(i, bought, state.ap, 1);
}

// 購入
function tryBuyAD(i, n = 1) {
    const bought = state.anko.dims[i].bought;
    const total = calcAdTotalCost(i, bought, n);
    if (!total) return false;

    if (state.ap.lt(total)) return false;

    state.ap = state.ap.minus(total);
    state.anko.dims[i].bought = bought.plus(n);

    save();
    updateUI();
    return true;
}

// 最大購入
function maxAffordableAD(i) {
    return maxAffordableAd(
        i,
        state.anko.dims[i].bought,
        state.ap
    );
}

/* ---- 自動化タブ ---- */

// 自動化解禁
function checkAutomationUnlocks() {
    // 最大値の更新も Decimal で
    state.maxZunda = Decimal.max(state.maxZunda, state.zunda);

    if (!state.autoTabUnlocked && state.maxZunda.gte('1e27')) {
        state.autoTabUnlocked = true;
        el("tab-auto").style.display = "block";
        markAutomationDirty();
        save();
    }

    for (let i = 0; i < 8; i++) {
        if (!state.auto.unlocked.zd[i] && state.maxZunda.gte(AUTO_THRESH_BY_ZUNDA.zd[i])) {
            state.auto.unlocked.zd[i] = true;
            markAutomationDirty();
            save();
        }
    }
    if (!state.auto.unlocked.boost && state.maxZunda.gte(AUTO_THRESH_BY_ZUNDA.boost)) {
        state.auto.unlocked.boost = true;
        markAutomationDirty();
        save();
    }
}

/***** 6. UI ****************************************************************/

"use strict";

/* ---- ビルド（既存UI＋イベント） ---- */
function build() {
    const root = el('producers');
    root.innerHTML = '';

    // ── ヘッダー（右上ツールチップ付き）を追加 ──
    const head = document.createElement('div');
    head.className = 'producers-head';
    head.innerHTML = `
                                        <div style="font-weight:800;">📦 ZUNDA DIMENSIONS</div>
                                        <div class="tip-wrap" aria-hidden="true" style="margin-left:auto;">
                                        <div class="tip-btn">?</div>
                                        <div class="tip-box">
                                        <div style="font-weight:700;margin-bottom:6px;">ディメンションの説明</div>
                                        <ul style="margin:0;padding-left:18px;">
                                        <li>ZundaDimension<i>1</i> はずんだを生成します。</li>
                                        <li>ZundaDimension<i>2</i> 以降は下位ディメンションを生成します。</li>
                                        <li>コストは購入ごとに上昇します。</li>
                                        </ul>
                                        </div>
                                        </div>
`;
    root.appendChild(head);
    for (let i = 1; i <= 8; i++) {
        const hasGen = i <= 7;
        const row = document.createElement('div');
        row.className = 'row'; row.id = `row-zd${i}`;
        const name = `ZundaDimension${i}`;
        row.innerHTML = `
                                      <div><div class="name">${name}</div></div>
                                      <div class="counts">
                                        <span class="pill">購入数:<span id="owned-zd${i}">0</span></span>
                                        ${hasGen ? `<span class="pill">生成数:<span id="gen-zd${i}">0</span></span>` : ''}
                                      </div>
                                      <div class="btns">
                                        <button id="buy1-zd${i}" class="buy"><span class="label">購入×1</span><span class="cost" id="cost1-zd${i}">-</span></button>
                                        <button id="buyMax-zd${i}" class="buy"><span class="label">最大購入</span><span class="cost" id="costMax-zd${i}">-</span></button>
                                      </div>`;
        root.appendChild(row);
    }
    for (let i = 2; i <= 8; i++) { const row = el(`row-zd${i}`); if (row) row.style.display = "none"; }

    for (let i = 1; i <= 8; i++) {
        el(`buy1-zd${i}`).addEventListener('click', () => {
            if (buy(tiers[i], 1)) {
                onBuyZundaDimension(i, 1);
                if (edaUnlocked) state.eda.amount += 1 * (getEffects().edaGetMul ?? 1);
                updateUI();
            }
        });
        el(`buyMax-zd${i}`).addEventListener('click', () => {
            const n = maxAffordable(tiers[i]);
            if (n > 0 && buy(tiers[i], n)) {
                onBuyZundaDimension(i, n);
                if (edaUnlocked) state.eda.amount += n * (getEffects().edaGetMul ?? 1);
                updateUI();
            }
        });
    }

    // Boost
    el("buyBoost").addEventListener("click", tryBuyBoost);
    el("buyBoostMax").addEventListener("click", () => { const m = maxBoostAffordableZunda(); if (m > 0 && canBuyBoost()) buyBoostMany(m); });
    el('buyAllMax').addEventListener('click', buyAllMax);
    el("doAscend").addEventListener("click", doAscend);
    el('doPrestigeSpeed').addEventListener('click', () => doPrestige('speed'));
    el('doPrestigePower').addEventListener('click', () => doPrestige('power'));
    el('doPrestigeCost').addEventListener('click', () => doPrestige('cost'));

    // 設定
    el('export').addEventListener('click', () => { save(); const raw = localStorage.getItem(SAVE_KEY) || ''; navigator.clipboard.writeText(raw || ''); alert('セーブデータをコピーしました。'); });
    el('import').addEventListener('click', () => { const raw = prompt('セーブデータ(JSON)を貼り付けてください'); if (!raw) return; try { JSON.parse(raw); localStorage.setItem(SAVE_KEY, raw); location.reload(); } catch (e) { alert('無効なデータです。'); } });
    el('hardReset').addEventListener('click', () => { if (!confirm('本当に全消去しますか？')) return; localStorage.clear(); flashSaveStatus('データを削除しました'); setTimeout(() => location.reload(), 500); });

    automationUI.buildAutomationUI();
    markAutomationDirty();

    // 枝豆UI
    el('edaBuyBoost').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        const c = edaBoostCost(); if (state.eda.amount < c) return alert('枝豆が足りません');
        state.eda.amount -= c; state.eda.boostBought++; state.boostEdamame++; updateUI();
    });
    el('edaBuyBoostMax').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        const m = maxAffordableByEdamame(n => edaBoostTotal(n)); if (m <= 0) return;
        state.eda.amount -= edaBoostTotal(m); state.eda.boostBought += m; state.boostEdamame += m; updateUI();
    });
    el('edaBuyExp').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        const c = edaExpCost(); if (state.eda.amount < c) return alert('枝豆が足りません');
        state.eda.amount -= c; state.eda.expBought++; updateUI();
    });
    el('edaBuyExpMax').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        let lo = 0, hi = 1; while (edaExpTotal(hi) <= state.eda.amount) hi *= 2;
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (edaExpTotal(mid) <= state.eda.amount) lo = mid; else hi = mid - 1; }
        if (lo <= 0) return;
        state.eda.amount -= edaExpTotal(lo); state.eda.expBought += lo; updateUI();
    });

    // 大豆UI
    el('soyBuyBoostUp').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        const c = soyBoostUpCost(); if (state.soy.amount < c) return alert('大豆が足りません');
        state.soy.amount -= c; state.soy.boostUpLv++; updateUI();
    });
    el('soyBuyBoostUpMax').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        let lo = 0, hi = 1; while (soyBoostUpTotal(hi) <= state.soy.amount) hi *= 2;
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (soyBoostUpTotal(mid) <= state.soy.amount) lo = mid; else hi = mid - 1; }
        if (lo <= 0) return; state.soy.amount -= soyBoostUpTotal(lo); state.soy.boostUpLv += lo; updateUI();
    });
    el('soyBuyZd8').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        const c = soyZd8Cost(); if (state.soy.amount < c) return alert('大豆が足りません');
        state.soy.amount -= c; state.soy.zd8Lv++; updateUI();
    });
    el('soyBuyZd8Max').addEventListener('click', () => {
        if (!edaUnlocked) return alert('枝豆サブタブ未解禁です');
        let lo = 0, hi = 1; while (soyZd8Total(hi) <= state.soy.amount) hi *= 2;
        while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (soyZd8Total(mid) <= state.soy.amount) lo = mid; else hi = mid - 1; }
        if (lo <= 0) return; state.soy.amount -= soyZd8Total(lo); state.soy.zd8Lv += lo; updateUI();
    });
}

/* ========== ウィンドウ全体のサイズ変更 ========== */
function updateAppScale() {
    const baseWidth = UI_LAYOUT.appBaseWidth;
    const tabWidth = UI_LAYOUT.tabWidth;
    const charWidth = UI_LAYOUT.charWidth;
    const gap = UI_LAYOUT.gap;
    const bodyPadding = UI_LAYOUT.bodyPaddingX;

    const vw = window.innerWidth;

    // 右カラムに実際に使える横幅
    const available = vw - bodyPadding - tabWidth - charWidth - (gap * 2)

    // 基準 1120px がちょうど入るようにスケール計算（最大1）
    let scale = available / baseWidth;
    scale = Math.min(1, scale);
    scale = Math.max(0.5, scale); // 小さすぎると読めないので下限(お好み)

    document.documentElement.style.setProperty('--app-scale', scale);
}

window.addEventListener('resize', updateAppScale);
window.addEventListener('load', updateAppScale);

/* ========== キャラクター表示 ========== */

// ずんだもん吹き出し：文字送り表示(タイプライター風)
export const Bubble = createBubble({
    linesNormal: ZUNDA_LINES_NORMAL,
    autoDelayMs: ZUNDA_AUTO_DELAY_MS,
    linesByProgress: ZUNDA_LINES_BY_PROGRESS,
    spriteMap: ZUNDA_SPRITE,
    typeCps: 20,
    enableAutoTalk: true,
});

/* ========== サブタブ（ZUNDA / EDAMAME） ========== */
const SUBTAB_KEY = 'zunda_subtab';
const EDA_UNLOCK_KEY = 'zunda_edamame_unlocked';
let edaUnlocked = false; // 1e150 到達で true（恒久）
let edaHintShown = false; // 1e120 到達でヒント表示

function setEdaButtonState() {
    const btn = document.getElementById('subtab-eda');
    if (!btn) return;
    if (edaUnlocked) {
        btn.textContent = '枝豆';
        btn.classList.remove('disabled');
    } else {
        btn.textContent = edaHintShown ? 'ずんだ1e150以上で解禁' : '???';
        btn.classList.add('disabled');
        const vz = document.getElementById('z-sub-zd');
        const ve = document.getElementById('z-sub-eda');
        if (vz) vz.classList.add('active');
        if (ve) ve.classList.remove('active');
    }
}
function switchZSub(name) {
    if (name === 'z-sub-eda' && !edaUnlocked) name = 'z-sub-zd';
    document.querySelectorAll('.subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.target === name));
    const subviews = document.querySelectorAll('.z-subview');
    subviews.forEach(v => {
        if (v.id === name) { v.style.display = 'block'; v.classList.add('active'); }
        else { v.style.display = 'none'; v.classList.remove('active'); }
    });
    try { localStorage.setItem(SUBTAB_KEY, name); } catch (e) { }
}
document.addEventListener('click', (e) => {
    const b = e.target.closest('.subtab-btn'); if (!b) return;
    const tgt = b.dataset.target; if (!tgt) return;
    if (tgt === 'z-sub-eda' && !edaUnlocked) return;
    switchZSub(tgt);
});
(function initZSub() {
    try { edaUnlocked = JSON.parse(localStorage.getItem(EDA_UNLOCK_KEY) || 'false'); } catch (e) { edaUnlocked = false; }
    setEdaButtonState();
    let n = 'z-sub-zd'; try { n = localStorage.getItem(SUBTAB_KEY) || 'z-sub-zd'; } catch (e) { }
    if (!edaUnlocked) n = 'z-sub-zd';
    switchZSub(n);
})();

/* ========== ずんだディメンション ========== */

// コストUI更新
const costsUI = createCostsUI({
    el, fmt,
    getState: () => state,
    getTiers: () => tiers,
    costAt, maxAffordable, totalCost,
    edaBoostCost, edaExpCost,
    soyBoostUpCost, soyZd8Cost,
});

// ZD2以降の表示/非表示切り替え
const visibilityUI = createVisibilityUI({
    getTiers: () => tiers,
    D,
});

// ブースト・アセンションUI更新
const boostAscUI = createBoostAscUI({
    el, fmt, fmt2, D, Decimal,
    getState: () => state,
    ASC_UNLOCK,
    boostTotal, getBoostPerItem,
    zundaBoostCost, canUseBoost, maxBoostAffordableZunda,
    ascNewMultFrom,
    canAscend: ascSys.canAscend,
});

// プレステージのUI更新
const prestigeUI = createPrestigeUI({
    getState: () => state,
    el,
    D,
    toNum,
    PRESTIGE_UNLOCK,
    prestigeRawLevelFromZ,
});

function markPrestigeDirty() {
    prestigeUI.markDirty();
}

function refreshPrestigeUIWrapper() {
    prestigeUI.refreshIfDirty();
}

// 解禁UI
function checkUnlockPanels() {
    const z = state.zunda;
    if (!state.unlocks.boost && z.gte('1e8')) { state.unlocks.boost = true; el("boostPanel").style.display = "block"; save(); }
    if (!state.unlocks.allMax && z.gte('1e8')) { state.unlocks.allMax = true; el("allMaxPanel").style.display = "block"; save(); }
    if (!state.unlocks.asc && z.gte('1e13')) { state.unlocks.asc = true; el("ascPanel").style.display = "block"; save(); }
    if (!state.unlocks.prestige && z.gte('1e30')) { state.unlocks.prestige = true; el("prestigePanel").style.display = "block"; save(); }
}

// 枝豆/大豆UI更新
function refreshEdamameSoyUI() {
    const setText = (id, v) => { const n = el(id); if (n) n.textContent = v; };
    setText('edaAmount', softFmt(state.eda.amount));
    setText('boostCount2', (state.boostEdamame || 0));
    setText('edaExpAdd', (getExpAdd()).toFixed(2));
    setText('soyAmount', softFmt(state.soy.amount));
    setText('soyps', softFmt(calcSoyPS()));
    setText('boostPerItemNow', "×" + getBoostPerItem().toFixed(4));
    setText('zd8Mult', "×" + getZd8Mult().toFixed(0));
}

// 枝豆・大豆ボタンの活性／非活性を反映
function refreshEdamameSoyButtons() {
    const setDis = (id, dis) => { const b = document.getElementById(id); if (b) b.disabled = !!dis; };

    // 未解禁なら全部オフ
    if (!edaUnlocked) {
        setDis('edaBuyBoost', true);
        setDis('edaBuyBoostMax', true);
        setDis('edaBuyExp', true);
        setDis('edaBuyExpMax', true);
        setDis('soyBuyBoostUp', true);
        setDis('soyBuyBoostUpMax', true);
        setDis('soyBuyZd8', true);
        setDis('soyBuyZd8Max', true);
        return;
    }

    // 枝豆（ブースト購入）
    const canEdaBoost = state.eda.amount >= edaBoostCost();
    const canEdaBoostMax = maxAffordableByEdamame(n => edaBoostTotal(n)) > 0;
    setDis('edaBuyBoost', !canEdaBoost);
    setDis('edaBuyBoostMax', !canEdaBoostMax);

    // 枝豆（指数強化）
    const canEdaExp = state.eda.amount >= edaExpCost();
    const canEdaExpMax = (function () { let lo = 0, hi = 1; while (edaExpTotal(hi) <= state.eda.amount) hi *= 2; while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (edaExpTotal(mid) <= state.eda.amount) lo = mid; else hi = mid - 1; } return lo > 0; })();
    setDis('edaBuyExp', !canEdaExp);
    setDis('edaBuyExpMax', !canEdaExpMax);

    // 大豆（ブースト強化）
    const canSoyBoostUp = state.soy.amount >= soyBoostUpCost();
    const canSoyBoostUpMax = (function () { let lo = 0, hi = 1; while (soyBoostUpTotal(hi) <= state.soy.amount) hi *= 2; while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (soyBoostUpTotal(mid) <= state.soy.amount) lo = mid; else hi = mid - 1; } return lo > 0; })();
    setDis('soyBuyBoostUp', !canSoyBoostUp);
    setDis('soyBuyBoostUpMax', !canSoyBoostUpMax);

    // 大豆（ZD8強化）
    const canSoyZd8 = state.soy.amount >= soyZd8Cost();
    const canSoyZd8Max = (function () { let lo = 0, hi = 1; while (soyZd8Total(hi) <= state.soy.amount) hi *= 2; while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (soyZd8Total(mid) <= state.soy.amount) lo = mid; else hi = mid - 1; } return lo > 0; })();
    setDis('soyBuyZd8', !canSoyZd8);
    setDis('soyBuyZd8Max', !canSoyZd8Max);
}

/* ========== サブタブ（ANKO / SKILL / CHALLENGE / RACE） ========== */

// サブタブ切替（AP表示は常時なので触らない）
(function initAnkoSubtabs() {
    const root = document.getElementById('view-anko');
    if (!root) return;
    const btns = root.querySelectorAll('.anko-subtab-btn');
    const views = root.querySelectorAll('.anko-subview');
    btns.forEach(b => b.addEventListener('click', () => {
        btns.forEach(x => x.classList.toggle('active', x === b));
        views.forEach(v => v.classList.toggle('active', v.id === b.dataset.target));
    }));
})();

// AP表示の共通更新
function refreshAnkoAP() {
    const apEl = document.getElementById('apAmount');
    if (apEl) apEl.textContent = (state.ap || 0).toString();
}


/* ========== あんこディメンション ========== */

// ビルド（初回）
(function buildAnkoDims() {
    const root = document.getElementById('ankoDimsList'); if (!root) return;
    root.innerHTML = '';

    // 上部：あんこ量の大きな表示（サブタブ内）
    const head = document.createElement('section');
    head.className = 'panel';
    head.style.marginBottom = '10px';
    head.innerHTML = `
                              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                                <div>
                                  <div style="font-weight:800;color:#ffe7cf;">Anko</div>
                                  <div id="ankoAmount" style="font-size:40px;font-weight:900;color:#ffd8a0;text-shadow:0 0 8px rgba(200,140,80,.35);">0</div>
                                  <div style="color:#d7c5b1;font-size:12px;margin-top:4px;">
                                    APS: <span id="ankops">0</span>/s
                                  </div>
                                </div>
                                <div class="pill" style="min-width:220px;text-align:center;">
                                  ずんだディメンション効率倍率&nbsp;×<span id="ankoZMult">1</span>
                                </div>
                              </div>
`;
    root.appendChild(head);

    // AD1..8 列
    for (let i = 1; i <= 8; i++) {
        const row = document.createElement('div');
        row.className = 'anko-dim-row';
        // AD8は生産数表示なし
        const prodCell = (i <= 7) ? `<span class="pill">生産数: <span id="ad${i}-ps">1</span></span>` : '';
        const cost = adCostAt(i);
        const costLabel = (cost == null) ? '未設定' : `AP ${cost}`;

        row.innerHTML = `
                                  <div class="name">AnkoDimension${i}</div>
                                  <div class="counts">
                                    <span class="pill">購入数: <span id="ad${i}-owned">${state.anko.dims[i].bought || D(0)}</span></span>
                                    ${prodCell}
                                  </div>
                                  <div style="display:flex;gap:8px;justify-content:flex-end;">
                                    <button id="ad${i}-buy1" class = "buy" ${cost == null ? 'disabled' : ''}>購入×1<br><span id="ad${i}-c1" class="cost">${costLabel}</span></button>
                                    <button id="ad${i}-buyMax" class = "buy" ${cost == null ? 'disabled' : ''}>最大購入</button>
                                  </div>
                                `;
        root.appendChild(row);

        const b1 = row.querySelector(`#ad${i}-buy1`);
        const bm = row.querySelector(`#ad${i}-buyMax`);
        if (b1) b1.addEventListener('click', () => { tryBuyAD(i, 1); });
        if (bm) bm.addEventListener('click', () => {
            const m = maxAffordableAD(i);
            if (m > 0) tryBuyAD(i, m);
        });
    }
})();

// あんこディメンション更新
function refreshAnkoDimsUI() {
    // APS = AD1 の購入数 × 基礎生産
    const ad1 = state.anko.dims[1];
    const ankops = (ad1.bought || D(0)) * (ad1.prodPerSec || 1);

    // あんこ表示
    const ankoEl = document.getElementById('ankoAmount');
    if (ankoEl) ankoEl.textContent = fmt(state.anko.amount);

    // APS表示
    const ankopsEl = document.getElementById('ankops');
    if (ankopsEl) ankopsEl.textContent = softFmt(ankops);

    // ずんだ効率倍率 = Anko^0.5（Decimalで整形）
    const aDec = (state.anko.amount instanceof Decimal) ? state.anko.amount : D(state.anko.amount || 0);
    const multDec = aDec.lte(0) ? D(1) : aDec.pow(0.5);
    const zMultEl = document.getElementById('ankoZMult');
    if (zMultEl) zMultEl.textContent = fmt(multDec);

    // 各ADの行（既存のまま）
    for (let i = 1; i <= 8; i++) {
        const own = document.getElementById(`ad${i}-owned`);
        if (own) own.textContent = softFmt(state.anko.dims[i].bought || D(0));

        if (i <= 7) {
            // 下位ディメンションによって実際に「生産された量（累積）」を表示
            const produced = state.anko.dims[i].generated;
            const elps = document.getElementById(`ad${i}-ps`);
            if (elps) elps.textContent = softFmt(produced);
        }

        const c = adCostAt(i);
        const c1 = document.getElementById(`ad${i}-c1`);
        if (c1) c1.textContent = (c == null) ? '未設定' : `AP ${c}`;
        const b1 = document.getElementById(`ad${i}-buy1`);
        const bm = document.getElementById(`ad${i}-buyMax`);
        b1.disabled = !(c != null && D(state.ap || 0).gte(c));
        if (bm) bm.disabled = !(c != null && maxAffordableAD(i) > 0);
    }
}

/* ========== あんこスキル ========== */

const askill = initAskillTree({
    getState: () => state,
    save,
    recomputeAllSkillEffects,
    getZdMultFromUnspentAp,
    getASkillLabel,
    getASkillDesc,

    ASKILL_POS,
    ASKILL_EDGES,
    ASKILL_COSTS,
    ASKILL_PREREQ,
});



/* ========== あんこチャレンジ ========== */

// あんこチャレンジUI構築
const ankoChalUI = initAnkoChallengeUI({
    getState: () => state,
    ACHAL_DEFS,
    startAnkoChallenge: () => { },
});

/* ---- 自動化 ---- */

const automationLogic = createAutomationLogic({
    getState: () => state,
    save,
    onAfterToggle: () => {
        automationUI.markDirty();
        automationUI.refreshIfDirty(); // 即反映したいなら
    },
});

const automationCardsUI = createAutomationCardsUI({
    getState: () => state,
    el,
    save,
    attachNumericInputHandler,
    Decimal,
});

const automationUI = initAutomationUI({
    getState: () => state,
    el,
    fmt,
    AUTO_THRESH_BY_ZUNDA,
    maybeBuildAscAutomationCard: automationCardsUI.maybeBuildAscAutomationCard, // ★UI側
    toggleAllAutomation: automationLogic.toggleAllAutomation,                  // ★logic側
    save,
});

function markAutomationDirty() {
    automationUI.markDirty();
}

const hud = createHUD({
    getState: () => state,
    el,
    fmt,
    effectiveZps,
});

const miscBars = createMiscBars({
    getState: () => state,
});

const zundaDimsUI = createZundaDimsUI({
    el,
    softFmt,
    getTiers: () => tiers,
});

function updateAutomationIfDirty() {
    automationUI.refreshIfDirty();
}

const updateUI = createUpdateUI({
    updateHUD: hud.updateHUD,
    updateZundaDimsSummary: zundaDimsUI.updateZundaDimsSummary,

    refreshCosts: costsUI.refreshCosts,
    refreshBoostAndAsc: boostAscUI.refreshBoostAndAsc,
    updateVisibility: visibilityUI.updateVisibility,

    refreshPrestigeUIWrapper,

    refreshEdamameSoyUI,
    refreshEdamameSoyButtons,
    setEdaButtonState,

    refreshAnkoAP,
    refreshAnkoDimsUI,

    askill, // すでに askill を init してる前提

    updateAutomationIfDirty, // ここは automationUI.refreshIfDirty() を包むのがおすすめ
    updateMiscBars: miscBars.updateMiscBars,
});

const ankoChalLogic = createAnkoChallengeLogic({
    getState: () => state,
    D,
    doAnconityReset,
    isChal,
    grantAnkoChallengeReward,

    recomputeAllSkillEffects,
    refreshBoostAndAsc: boostAscUI.refreshBoostAndAsc,
    refreshAscUI: boostAscUI.refreshAscUI,
    refreshCostMultipliers,
    updateUI,
    save,

    onUIUpdate: () => ankoChalUI.refreshAll(),
});

// UIの開始ボタンがロジックを呼ぶように差し替え
ankoChalUI.setStartHandler(ankoChalLogic.startAnkoChallenge);


/***** 7. EVENTS *************************************************************/

/* デバッグ用キー操作 */
document.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') {
        state.zunda = new Decimal('1.8e308');
        state.ap = D(1);
        flashSaveStatus('💚 デバッグ: ずんだを 1e300 に設定しました');
        updateUI();
    }
});

/* 画面非表示からの復帰処理 */
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        applyOfflineFromLastActive({ showToast: true });
        updateUI();
    } else {
        // 隠れた瞬間も「最後に見えてた時刻」として更新しておくと安定
        state.lastActiveMs = Date.now();
    }
});

window.addEventListener('focus', () => {
    applyOfflineFromLastActive({ showToast: true });
    updateUI();
});

document.addEventListener("DOMContentLoaded", () => {
    Bubble.init();
});

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
});

document.addEventListener("DOMContentLoaded", () => {
    ankoChalUI.init();
});


/***** 8. LOOP ***************************************************************/

/* ---- Tick ---- */

function tick() {
    const now = performance.now();
    const dt = clamp((now - state.lastTime) / 1000, 0, 1);
    state.lastTime = now;
    tickStep(dt, { skipUI: false });
}

function tickStep(dt, { skipUI }) {
    state.runSeconds += dt;
    state.runSecondsAnko += dt;

    runFastAutomation();

    const ef = getEffects();

    const mults = calcTickMults(state, {
        getBoostMult,
        getAscEffective,
        getZdMultFromUnspentAp,
        getZd8Mult,
        getAnkoZundaMult,
    }, ef);

    // ZUNDA: 上位→下位を生成
    tickZunda(state, dt, tiers, mults.zunda);
    markPrestigeDirty();

    state.zunda = state.zunda.add(effectiveZps().mul(dt));

    checkAnconity();

    if (state.anconityReady) {
        if (!skipUI) updateUI();
        return;
    }

    // soy（NumberのままでOK）
    {
        let sps = calcSoyPS();
        if (edaUnlocked) {
            if (!Number.isFinite(sps) || sps < 0) sps = 0;
            state.soy.amount += sps * dt;
        } else {
            state.soy.amount = 0;
        }
    }

    // ANKO
    tickAnko(state, dt, mults.anko);

    if (state.zunda.gt(state.maxZunda)) {
        state.maxZunda = Decimal.max(state.maxZunda, state.zunda);
    }

    checkEdaSubtabProgress();
    checkAutomationUnlocks(); checkUnlockPanels();
    evaluateZundaProgress();

    if (!skipUI) updateUI();
}

/* ---- ループ ---- */
let loopId = null;
let lastFrame = 0;

function start() {
    if (loopId) return;
    state.lastTime = performance.now();
    const loop = () => {
        try {
            if (nowMs() - lastFrame >= FRAME_INTERVAL_MS) {
                lastFrame = nowMs();
                tick();
            }
        }
        catch (err) { console.error('[tick error]', err); flashSaveStatus('エラー: UI更新に失敗（コンソール参照）'); }
        finally { loopId = requestAnimationFrame(loop); }
    };
    loopId = requestAnimationFrame(loop);
}

function applyOfflineProgress(sec) {
    let remain = sec;
    while (remain > 0) {
        const dt = (remain > 60) ? 10 : (remain > 10 ? 1 : 0.1);
        const step = Math.min(dt, remain);
        tickStep(step, { skipUI: true });
        remain -= step;
    }
}


/***** 9. BOOT ***************************************************************/

function bootstrap() {
    /* ---- 初期化 ---- */
    function refreshCostsInit() { refreshCostMultipliers(); costsUI.refreshCosts(); }
    function setInitialEdaButton() { setEdaButtonState(); }
    build();
    load();
    refreshCostsInit();
    refreshCostMultipliers();
    setEdaButtonState();
    recomputeAllSkillEffects();
    applyOfflineFromLastActive({ showToast: true });
    ankoChalUI.refreshAnkoChallengeRunningUI();
    updateUI();
    start();
    const ankoBtn = document.getElementById('doAnconity');
    if (ankoBtn) {
        ankoBtn.addEventListener('click', () => {
            if (!state.anconityReady) return;

            const ok = confirm(
                "アンコニティを実行しますか？\n\n" +
                "以下の要素がリセットされます：\n" +
                "・ずんだ\n" +
                "・ずんだディメンション\n" +
                "・ずんだブースト\n" +
                "・アセンション\n" +
                "・プレステージ\n" +
                "・枝豆 / 大豆\n" +
                "Anko Point を獲得して進行します。"
            );
            if (!ok) return;

            ankoBtn.disabled = true; // 多重防止
            ankoShakeAndParticles(ankoBtn, () => {
                doAnconityExecute();
                ankoBtn.disabled = false;
            });
        });
    }
    setInitialEdaButton();
    Bubble.enqueueTutorialForProgress(state.zundaProgress);
    Bubble.showNextZundaLine();
    setInterval(save, 5000);
    setInterval(automationTick, 8000);
}
document.addEventListener('DOMContentLoaded', bootstrap);