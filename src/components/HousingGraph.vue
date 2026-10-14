<script setup>
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { TreeChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import VChart from "vue-echarts";
use([CanvasRenderer, TreeChart, TooltipComponent]);
defineProps({ option: Object });
</script>

<template>
  <v-chart :option="option" autoresize />
</template>
