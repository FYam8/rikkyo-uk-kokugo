import data from '../metadata/practice_bank.json';
import routing from '../metadata/practice_routing.json';
import {createSchoolPractice,isSchoolDrillAnswerCorrect} from './schoolPractice.js';
const practice=createSchoolPractice(data,routing.unitSkills);
export const DRILL_BANK=practice.bank,DRILL_LIBRARY_DOMAINS=practice.domains,DRILL_LIBRARY_STRATEGY='解答の進め方',KANJI_HISTORY={};
export const PRACTICE_POLICY={retainLifetimeIds:[],legacyRepairExcludedIds:[]};
export const getDrillLibraryItems=()=>practice.items;
export const drillLibraryTargetForWeakness=skill=>({domain:skill});
export const isDrillAnswerCorrect=isSchoolDrillAnswerCorrect;
