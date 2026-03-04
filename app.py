import psycopg2
import gradio as gr
import os

# 1. DB 접속 설정
DB_CONFIG = {
    "host": "team4-db.postgres.database.azure.com",
    "database": "postgres",
    "user": "azure_root",
    "password": "qwer1234!",
    "port": "5432",
    "sslmode": "require",
}


def get_shelter_data_from_db():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        query = """
            SELECT shelter_name, road_addr, lat, lon FROM heat_shelter
            UNION ALL
            SELECT shelter_name, road_addr, lat, lon FROM cold_shelter
        """
        cur.execute(query)
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"❌ DB 에러: {e}")
        return []


def create_map_with_route():
    shelters = get_shelter_data_from_db()
    if not shelters:
        return "<h3>데이터 로드 실패</h3>"

    shelter_list_js = []
    for s in shelters:
        name = str(s[0]).replace("'", "\\'")
        shelter_list_js.append(f"{{name: '{name}', lat: {s[2]}, lng: {s[3]}}}")
    shelter_js_string = "[" + ",".join(shelter_list_js) + "]"

    # 📂 [핵심] 자바스크립트 파일을 읽어옵니다.
    with open("map_replay.js", "r", encoding="utf-8") as f:
        js_code = f.read()

    # 파이썬 f-string 대신 문자열 결합을 써서 중괄호 충돌을 피합니다.
    map_html = f"""
    <div id="map" style="width:100%; height:600px;"></div>
    <script type="text/javascript" src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=53573d8bf722b4bc75ea45fd95a4ed3c&libraries=services"></script>
    <script>
        {js_code}
        // 파이썬에서 가져온 DB 데이터를 자바스크립트 함수에 전달
        initMarkers({shelter_js_string});
    </script>
    """

    return f"""
    <iframe 
        srcdoc="{map_html.replace('"', '&quot;')}" 
        width="100%" 
        height="650px" 
        style="border:none;"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="geolocation"
    ></iframe>
    """


with gr.Blocks() as demo:
    gr.Markdown("# 👵 어르신 안심 쉼터 - 실시간 도보 길안내")
    gr.Markdown("아래 버튼을 누르면 길안내가 시작됩니다.")
    btn = gr.Button("🏠 내 주변 쉼터 찾기", variant="primary")
    map_display = gr.HTML(
        "<div style='height:650px; background:#f0f0f0; display:flex; align-items:center; justify-content:center;'>서비스 시작 버튼을 눌러주세요</div>"
    )
    btn.click(fn=create_map_with_route, outputs=map_display)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    demo.launch(server_name="localhost", server_port=port)
