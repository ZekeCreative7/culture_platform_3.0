#!/bin/bash
# Culture Platform 3.0 Launcher
# Double-click this file in Finder to launch the app

cd "$(dirname "$0")"

# Kill any existing instance on port 8501
lsof -ti:8501 | xargs kill -9 2>/dev/null || true

echo "🚀 Culture Platform 3.0 시작 중..."

# Start Streamlit in background
python3 -m streamlit run app.py \
    --server.headless=true \
    --server.port=8501 \
    --server.enableStaticServing=true \
    --browser.gatherUsageStats=false &

STREAMLIT_PID=$!
echo "PID: $STREAMLIT_PID"

# Wait for server to be ready (up to 15s)
for i in $(seq 1 30); do
    if curl -s http://localhost:8501 > /dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

# Open browser
open http://localhost:8501
echo "✅ 브라우저가 열렸습니다. http://localhost:8501"

# Keep terminal open so server stays alive
wait $STREAMLIT_PID
