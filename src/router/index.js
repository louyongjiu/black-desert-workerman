import { createRouter, createWebHistory } from "vue-router";
const HomeView = () => import("../views/HomeView.vue")
const PlantzonesView = () => import("../views/PlantzonesView.vue")
const LodgingView = () => import("../views/LodgingView.vue")
const ResourcesView = () => import("../views/ResourcesView.vue")
const SettingsView = () => import("../views/SettingsView.vue")
const OtherTownsView = () => import("../views/OtherTownsView.vue")
const WorkshopsView = () => import("../views/WorkshopsView.vue")
const HouseCraft = () => import("../views/HouseCraft.vue")
const DropratesView = () => import("../views/DropratesView.vue")
const FishsizeView = () => import("../views/FishsizeView.vue")
const RouterTestsView = () => import("../views/RouterTestsView.vue")
const RegionMapView = () => import("../views/RegionMapView.vue")

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: '/plantzones',
      component: PlantzonesView
    },
    {
      path: '/resources',
      component: ResourcesView
    },
    {
      path: '/settings',
      component: SettingsView
    },
    {
      /*path: "/about",
      component: AboutView,*/

      path: "/about",
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import("../views/AboutView.vue"),
    },
    {
      path: '/othertowns',
      component: OtherTownsView
    },
    {
      path: '/workshops',
      component: WorkshopsView
    },
    {
      path: '/housecraft',
      component: HouseCraft
    },
    {
      path: '/droprates',
      component: DropratesView
    },
    {
      path: '/routertests',
      component: RouterTestsView
    },
    {
      path: '/regionmap',
      component: RegionMapView
    },
    // temporary
    {
      path: "/fishsize",
      component: FishsizeView,
    },
    // deprecated
    {
      path: "/lodging",
      component: LodgingView,
    },
  ],
});

export default router;
