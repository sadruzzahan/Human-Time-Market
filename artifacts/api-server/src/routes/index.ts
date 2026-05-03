import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import skillCategoriesRouter from "./skillCategories";
import listingsRouter from "./listings";
import rfpsRouter from "./rfps";
import orderBookRouter from "./orderBook";
import dashboardRouter from "./dashboard";
import derivativesRouter from "./derivatives";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(skillCategoriesRouter);
router.use(listingsRouter);
router.use(rfpsRouter);
router.use(orderBookRouter);
router.use(dashboardRouter);
router.use(derivativesRouter);

export default router;
