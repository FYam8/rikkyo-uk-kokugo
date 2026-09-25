import {buildSchoolReview} from './schoolReview.js';
import {getReviewProfile} from './reviewProfiles.js';
import {LEARNING_PATH_CONFIG} from './schoolLearningConfig.js';
export const buildReviewExplanation=args=>buildSchoolReview(args,getReviewProfile(args.question.id),LEARNING_PATH_CONFIG.scoreTargets);
