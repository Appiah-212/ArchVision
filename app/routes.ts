import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route('visualizer/:id', './routes/visualizer.$id.tsx'),
    route('research', './routes/research.tsx')
] satisfies RouteConfig;
