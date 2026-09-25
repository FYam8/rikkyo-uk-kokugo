import data from '../metadata/practice_bank.json';
import {createSchoolPractice,isSchoolDrillAnswerCorrect} from './schoolPractice.js';
const practice=createSchoolPractice(data,{"RUK-ORIGINAL-K01": "漢字の読み書き", "RUK-ORIGINAL-K02": "漢字の読み書き", "RUK-ORIGINAL-K03": "漢字の読み書き", "RUK-ORIGINAL-K04": "漢字の読み書き", "RUK-ORIGINAL-K05": "漢字の読み書き", "RUK-ORIGINAL-K06": "漢字の読み書き", "RUK-ORIGINAL-K07": "漢字の読み書き", "RUK-ORIGINAL-K08": "漢字の読み書き", "RUK-ORIGINAL-K09": "文脈に合う言葉", "RUK-ORIGINAL-K10": "漢字の読み書き", "RUK-ORIGINAL-L01": "人物と表現を読み取る", "RUK-ORIGINAL-L02": "人物と表現を読み取る", "RUK-ORIGINAL-L03": "人物と表現を読み取る", "RUK-ORIGINAL-L04": "人物と表現を読み取る", "RUK-ORIGINAL-L05": "抜き出しの条件を守る", "RUK-ORIGINAL-L06": "根拠を使って説明する", "RUK-ORIGINAL-L07": "人物と表現を読み取る", "RUK-ORIGINAL-E01": "本文と選択肢を照合する", "RUK-ORIGINAL-E02": "抜き出しの条件を守る", "RUK-ORIGINAL-E03": "本文と選択肢を照合する", "RUK-ORIGINAL-E04": "本文と選択肢を照合する", "RUK-ORIGINAL-E05": "根拠を使って説明する", "RUK-ORIGINAL-E06": "根拠を使って説明する", "RUK-ORIGINAL-E07": "本文と選択肢を照合する"});
export const DRILL_BANK=practice.bank,DRILL_LIBRARY_DOMAINS=practice.domains,DRILL_LIBRARY_STRATEGY='解答の進め方',KANJI_HISTORY={};
export const PRACTICE_POLICY={retainLifetimeIds:[],legacyRepairExcludedIds:[]};
export const getDrillLibraryItems=()=>practice.items;
export const drillLibraryTargetForWeakness=skill=>({domain:skill});
export const isDrillAnswerCorrect=isSchoolDrillAnswerCorrect;
