/**
 * [1단계] 전역 변수 및 지도 초기 설정
 */
var container = document.getElementById("map");
var options = { center: new kakao.maps.LatLng(37.5665, 126.978), level: 4 };
var map = new kakao.maps.Map(container, options);

var myMarker = null;
var polyline = null;
var routeSteps = [];
var lastSpokenStep = -1;
var watchId = null;

var fontSize = 20;
var MIN_FONT_SIZE = 16;
var MAX_FONT_SIZE = 36;

/**
 * [2단계] 음성 출력 및 다시듣기 함수
 */
function speak(text) {
  var subtitleBox = document.getElementById("subtitle-box");
  if (subtitleBox) {
    // 안내 멘트를 가독성 좋게 줄바꿈 처리
    subtitleBox.innerHTML = "🔊 " + text.replace(/\. /g, ".<br>");
  }

  if (typeof SpeechSynthesisUtterance === "undefined") return;

  // 이전 음성 취소
  window.speechSynthesis.cancel();

  /**
   * [성대결절 느낌 해결법] 쉼표를 넣어 호흡을 조절합니다.
   */
  var smoothText = text
    .replace(/미터/g, " 미터, ")
    .replace(/후/g, "후,  ")
    .replace(/요/g, "요.   ")
    .replace(/다/g, "다.   ");

  var msg = new SpeechSynthesisUtterance(smoothText);
  var voices = window.speechSynthesis.getVoices();

  // 한국어 목소리 중 구글 엔진 우선 선택
  var preferredVoice =
    voices.find((v) => v.name.includes("Google") && v.lang === "ko-KR") ||
    voices.find((v) => v.name.includes("Yuna") && v.lang === "ko-KR") ||
    voices.find((v) => v.lang === "ko-KR");

  if (preferredVoice) msg.voice = preferredVoice;

  msg.lang = "ko-KR";
  msg.rate = 0.85; // 약간 느리지만 명확한 속도
  msg.pitch = 1.0; // 표준 음높이
  msg.volume = 1.0;

  window.speechSynthesis.speak(msg);
}

// 다시듣기 기능
function replayGuidance() {
  var subtitleBox = document.getElementById("subtitle-box");
  if (!subtitleBox) return;

  // innerHTML을 가져와서 🔊 아이콘만 제거합니다.
  // 이렇게 하면 <br> 태그가 살아있어서 speak 함수에서 다시 줄바꿈 처리가 됩니다.
  var currentHTML = subtitleBox.innerHTML.replace("🔊", "").trim();

  // <br> 태그를 마침표나 공백으로 바꿔서 TTS가 읽을 수 있는 텍스트로 변환
  var textToSpeak = currentHTML.replace(/<br>/g, " ");

  if (
    !textToSpeak ||
    textToSpeak.includes("찾는 중") ||
    textToSpeak.includes("확인했습니다")
  ) {
    speak(
      "현재 안내 중인 경로가 없습니다. 가고 싶은 쉼터를 먼저 선택해 주세요.",
    );
    return;
  }

  speak(textToSpeak);
}

// 목소리 로드 대기
if (window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = function () {
    window.speechSynthesis.getVoices();
  };
}

/**
 * [3단계] UI 레이어 생성 (다시듣기 버튼 포함)
 */
function createUI() {
  // 웰컴 레이어
  var welcome = document.createElement("div");
  welcome.id = "welcome-layer";
  welcome.style.cssText =
    "position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; text-align:center;";
  welcome.innerHTML = `<div style="font-size: 80px; margin-bottom: 20px;">🔊</div><h1 style="font-size: 30px;">반갑습니다!</h1><p style="font-size: 22px;">안내를 위해 <b>소리를 크게</b> 키워주세요.</p><button onclick="startApp()" style="margin-top: 30px; padding: 20px 50px; font-size: 24px; background: #4CAF50; color: white; border: none; border-radius: 15px; font-weight: bold;">확인했습니다</button>`;
  document.body.appendChild(welcome);

  // 메인 UI 컨테이너
  var ui = document.createElement("div");
  ui.style.cssText =
    "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); width:90%; z-index:9999; display:flex; flex-direction:column; gap:12px;";

  // 다시듣기(왼쪽)와 글자크기(오른쪽) 배치
  ui.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
        <button id="btn-replay" onclick="replayGuidance()" 
                style="padding:12px 18px; background:#FF9800; color:white; border:none; border-radius:10px; font-weight:bold; font-size:16px; box-shadow: 0 4px 8px rgba(0,0,0,0.3); cursor:pointer;">
            🔄 다시듣기
        </button>
        <div style="display:flex; gap:8px;">
            <button id="btn-font-plus" onclick="changeFontSize(4)" 
                    style="padding:12px 18px; background:white; border:1px solid #ccc; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer;">
                글자 +
            </button>
            <button id="btn-font-minus" onclick="changeFontSize(-4)" 
                    style="padding:12px 18px; background:white; border:1px solid #ccc; border-radius:10px; font-weight:bold; font-size:16px; cursor:pointer;">
                글자 -
            </button>
        </div>
    </div>
    <div id="subtitle-box" style="background:rgba(0,0,0,0.85); color:white; padding:20px; border-radius:15px; font-size:20px; font-weight:bold; text-align:center; min-height:80px; line-height:1.5; box-shadow: 0 4px 15px rgba(0,0,0,0.5);">주변 쉼터를 찾는 중...</div>
  `;
  document.body.appendChild(ui);
  updateFontSizeButtons();
}

/**
 * [4단계] 글자 크기 및 위치 설정 로직
 */
function changeFontSize(delta) {
  var newSize = fontSize + delta;
  if (newSize >= MIN_FONT_SIZE && newSize <= MAX_FONT_SIZE) {
    fontSize = newSize;
    var subtitleBox = document.getElementById("subtitle-box");
    if (subtitleBox) subtitleBox.style.fontSize = fontSize + "px";
  }
  updateFontSizeButtons();
}

function updateFontSizeButtons() {
  var btnPlus = document.getElementById("btn-font-plus");
  var btnMinus = document.getElementById("btn-font-minus");
  if (!btnPlus || !btnMinus) return;
  btnPlus.disabled = fontSize >= MAX_FONT_SIZE;
  btnMinus.disabled = fontSize <= MIN_FONT_SIZE;
  btnPlus.style.backgroundColor = btnPlus.disabled ? "#e0e0e0" : "white";
  btnMinus.style.backgroundColor = btnMinus.disabled ? "#e0e0e0" : "white";
}

function initLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var locPos = new kakao.maps.LatLng(lat, lng);
        if (!myMarker) {
          myMarker = new kakao.maps.Marker({
            position: locPos,
            map: map,
            image: new kakao.maps.MarkerImage(
              "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
              new kakao.maps.Size(35, 35),
            ),
          });
        } else {
          myMarker.setPosition(locPos);
        }
        map.setCenter(locPos);
        speak("내 위치를 확인했습니다. 가고 싶은 쉼터를 눌러보세요.");
      },
      (err) => speak("위치 정보를 가져올 수 없습니다."),
    );
  }
}

function startApp() {
  document.getElementById("welcome-layer").remove();
  initLocation();
}

/**
 * [5단계] 경로 검색 및 실시간 안내
 */
/**
 * [5단계] 경로 검색 및 실시간 안내 (유턴 방지 및 목적지 변경 최적화 버전)
 */
function findRoute(endLat, endLng, shelterName) {
  // [추가] 1. 목적지 변경 시 기존 추적 및 상태 확실히 초기화
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  lastSpokenStep = -1; 
  routeSteps = [];

  navigator.geolocation.getCurrentPosition(function (pos) {
    var startLat = pos.coords.latitude;
    var startLng = pos.coords.longitude;
    
    // [추가] 2. OSRM 옵션 최적화 (유턴 최소화 및 탐색 범위 확장)
    var url = "https://router.project-osrm.org/route/v1/foot/" + 
              startLng + "," + startLat + ";" + 
              endLng + "," + endLat + 
              "?overview=full&geometries=geojson&steps=true" +
              "&continue_straight=false" + // 유턴을 억지로 시키지 않고 길을 유연하게 찾음
              "&radiuses=50;50";          // 50미터 이내 보행 가능 도로 모두 탐색

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.code === "Ok") {
          var route = data.routes[0];
          
          // [추가] 3. 유턴/우회 필터링 (직선거리는 가까운데 경로가 너무 길면 가로채기)
          var directDist = getDistance(startLat, startLng, endLat, endLng);
          
          if (route.distance > directDist * 3 && directDist < 150) {
            // 경로 선은 그려주되, 말도 안 되는 뺑뺑이 안내는 차단합니다.
            drawRouteLine(route); // 선 그리는 함수 따로 분리(아래 참고)
            var intro = shelterName + "가 아주 가까운 곳에 있습니다. ";
            speak(intro + "지도가 안내하는 길이 너무 멀면, 주변의 횡단보도를 이용해 바로 건너오세요.");
            
            lastSpokenStep = 999; // 실시간 음성 안내가 나오지 않게 막음
            return; 
          }

          // 4. 정상적인 경로 안내 로직
          var durationMin = Math.max(1, Math.round(route.distance / 45)); // 어르신 보폭 기준

          routeSteps = [];
          route.legs[0].steps.forEach(function (step) {
            var m = step.maneuver;
            var dist = Math.round(step.distance);
            var stepText = "";
            if (m.type === "depart") stepText = "안내를 시작합니다. ";
            else if (m.type === "arrive") stepText = "목적지 근처에 도착했습니다. ";
            else {
              if (dist > 10) stepText = dist + "미터 직진 후 ";
              if (m.modifier === "left") stepText += "왼쪽으로 꺾으세요. ";
              else if (m.modifier === "right") stepText += "오른쪽으로 꺾으세요. ";
              else stepText += "앞으로 이동하세요. ";
            }
            routeSteps.push({ lat: m.location[1], lng: m.location[0], instruction: stepText });
          });

          // 자연스러운 첫 시작 멘트
          var introText = shelterName + "까지 약 " + durationMin + "분 걸립니다. ";
          var secondAction = routeSteps[1] ? routeSteps[1].instruction : "";
          speak(introText + "지금부터 안내를 시작할게요. 먼저 " + secondAction);

          // 5. 지도에 경로 선 그리기
          drawRouteLine(route);

          lastSpokenStep = 0;
          startTracking();
        }
      });
  });
}

/**
 * [보조 함수] 경로 선 그리기 로직 (코드가 중복되어 분리했습니다)
 */
function drawRouteLine(route) {
  var linePath = route.geometry.coordinates.map(c => new kakao.maps.LatLng(c[1], c[0]));
  if (polyline) polyline.setMap(null);
  polyline = new kakao.maps.Polyline({
    path: linePath,
    strokeWeight: 8,
    strokeColor: "#3301fc",
    strokeOpacity: 0.8
  });
  polyline.setMap(map);
  
  var bounds = new kakao.maps.LatLngBounds();
  linePath.forEach(p => bounds.extend(p));
  map.setBounds(bounds);
}

function startTracking() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    function (pos) {
      var curLat = pos.coords.latitude;
      var curLng = pos.coords.longitude;
      if (myMarker) myMarker.setPosition(new kakao.maps.LatLng(curLat, curLng));

      for (var i = 0; i < routeSteps.length; i++) {
        if (i <= lastSpokenStep) continue;
        var dist = getDistance(
          curLat,
          curLng,
          routeSteps[i].lat,
          routeSteps[i].lng,
        );
        if (dist < 40) {
          lastSpokenStep = i;
          var curText = "이제 " + routeSteps[i].instruction;
          var nextText = routeSteps[i + 1]
            ? "그 다음은 " + routeSteps[i + 1].instruction
            : "";
          speak(curText + nextText);
          break;
        }
      }
    },
    null,
    { enableHighAccuracy: true },
  );
}

function getDistance(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLon = ((lng2 - lng1) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 1000;
}

window.initMarkers = function (shelterData) {
  shelterData.forEach(function (s) {
    var marker = new kakao.maps.Marker({
      position: new kakao.maps.LatLng(s.lat, s.lng),
      map: map,
    });
    var content = `<div style="padding:10px; font-size:14px; color:black; min-width:150px;"><strong>${s.name}</strong><br><button onclick="findRoute(${s.lat}, ${s.lng}, '${s.name}')" style="margin-top:10px; cursor:pointer; width:100%; height:30px; background:#4CAF50; color:white; border:none; border-radius:5px;">🚶 길안내 시작</button></div>`;
    var infowindow = new kakao.maps.InfoWindow({
      content: content,
      removable: true,
    });
    kakao.maps.event.addListener(marker, "click", () =>
      infowindow.open(map, marker),
    );
  });
};

createUI();
