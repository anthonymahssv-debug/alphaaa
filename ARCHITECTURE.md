# ASCII Architecture

+----------------+
| Browser        |
+----------------+
        |
        v
+---------------------------+
| Vanilla JS Frontend SPA   |
+---------------------------+
        |
        | fetch('/api/*')
        v
+---------------------------+
| FastAPI Backend API       |
+---------------------------+
   |          |          |
   v          v          v
+------+  +--------+  +---------+
| DB   |  | Scores |  | Alerts  |
+------+  +--------+  +---------+

Static `data.json` is seed/fallback only.
