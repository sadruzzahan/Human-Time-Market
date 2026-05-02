import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import skillCategoriesRouter from "./skillCategories";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(skillCategoriesRouter);

export default router;
