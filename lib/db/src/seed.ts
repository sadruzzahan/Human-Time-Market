import { db, skillCategories } from "./index";
import { eq, isNull } from "drizzle-orm";

type ParentSeed = {
  name: string;
  slug: string;
  children: { name: string; slug: string }[];
};

export const SKILL_TAXONOMY: ParentSeed[] = [
  {
    name: "Software Engineering",
    slug: "software-engineering",
    children: [
      { name: "Frontend Development", slug: "frontend-development" },
      { name: "Backend Development", slug: "backend-development" },
      { name: "Mobile Development", slug: "mobile-development" },
      { name: "ML / AI Engineering", slug: "ml-ai-engineering" },
      { name: "DevOps / Infrastructure", slug: "devops-infrastructure" },
      { name: "Data Engineering", slug: "data-engineering" },
    ],
  },
  {
    name: "Design",
    slug: "design",
    children: [
      { name: "Product Design (UX/UI)", slug: "product-design" },
      { name: "Brand & Visual Design", slug: "brand-visual-design" },
      { name: "Motion & Animation", slug: "motion-animation" },
      { name: "Industrial Design", slug: "industrial-design" },
    ],
  },
  {
    name: "Legal",
    slug: "legal",
    children: [
      { name: "Corporate Law", slug: "corporate-law" },
      { name: "IP & Patent Law", slug: "ip-patent-law" },
      { name: "Employment Law", slug: "employment-law" },
      { name: "Regulatory & Compliance", slug: "regulatory-compliance" },
    ],
  },
  {
    name: "Finance",
    slug: "finance",
    children: [
      { name: "Financial Modeling", slug: "financial-modeling" },
      { name: "Investment Analysis", slug: "investment-analysis" },
      { name: "Accounting & Audit", slug: "accounting-audit" },
      { name: "CFO / Strategic Finance", slug: "cfo-strategic-finance" },
    ],
  },
  {
    name: "Marketing",
    slug: "marketing",
    children: [
      { name: "Growth & Performance", slug: "growth-performance" },
      { name: "Content & Copywriting", slug: "content-copywriting" },
      { name: "SEO / SEM", slug: "seo-sem" },
      { name: "Brand Strategy", slug: "brand-strategy" },
    ],
  },
  {
    name: "Data Science",
    slug: "data-science",
    children: [
      { name: "Analytics & Visualization", slug: "analytics-visualization" },
      { name: "Machine Learning Research", slug: "ml-research" },
      { name: "Data Strategy", slug: "data-strategy" },
    ],
  },
  {
    name: "Strategy & Management",
    slug: "strategy-management",
    children: [
      { name: "Product Management", slug: "product-management" },
      { name: "Business Strategy", slug: "business-strategy" },
      { name: "Operations", slug: "operations" },
      { name: "Executive Coaching", slug: "executive-coaching" },
    ],
  },
];

export async function seedSkillCategories() {
  let parentInserts = 0;
  let childInserts = 0;

  for (const parent of SKILL_TAXONOMY) {
    const existingParent = await db
      .select()
      .from(skillCategories)
      .where(eq(skillCategories.slug, parent.slug))
      .limit(1);

    let parentId: number;
    if (existingParent.length > 0) {
      parentId = existingParent[0].id;
    } else {
      const [created] = await db
        .insert(skillCategories)
        .values({ name: parent.name, slug: parent.slug, parentId: null })
        .returning();
      parentId = created.id;
      parentInserts++;
    }

    for (const child of parent.children) {
      const existingChild = await db
        .select()
        .from(skillCategories)
        .where(eq(skillCategories.slug, child.slug))
        .limit(1);
      if (existingChild.length === 0) {
        await db
          .insert(skillCategories)
          .values({ name: child.name, slug: child.slug, parentId });
        childInserts++;
      }
    }
  }

  const totalParents = await db
    .select()
    .from(skillCategories)
    .where(isNull(skillCategories.parentId));
  const total = await db.select().from(skillCategories);

  return {
    parentInserts,
    childInserts,
    totalParents: totalParents.length,
    totalCategories: total.length,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedSkillCategories()
    .then((res) => {
      console.log("Seed complete:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
