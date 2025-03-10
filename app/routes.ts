import {
  type RouteConfig,
  route,
  index,
} from "@react-router/dev/routes";

export default [
  index("./routes/home.tsx"),
  route("placelists", "./routes/placelists/index.tsx"),
  route("placelists/new", "./routes/placelists/new.tsx"),
  route("placelists/:id", "./routes/placelists/$id.tsx"),
  route("placelists/:id/edit", "./routes/placelists/$id.edit.tsx"),
  route("play/:sessionId", "./routes/play/$sessionId.tsx"),
] satisfies RouteConfig;
