import React from "react";
import { hm } from "../showcase.js";
export default function Features({}) {
  return (
    <section id="features" className="s37">
      <div className="s38">
        <div className="s39">
          <span className="s27">FEATURES</span>
          <h2 className="s28">
            실제 사무실을 그대로 옮긴
            <br />
            감각 공유 오피스
          </h2>
        </div>
        <div className="s40">
          <div className="s41">
            <span className="s42">01</span>
            <h3 className="s43">우리 회사 평면도 그대로</h3>
            <p className="s29">
              보내주신 평면도와 좌석 배치도로 도트 오피스를 만들어 드려요.
              팀원은 실제 자기 자리에 캐릭터를 앉히고, 층별로 오가며 동료를
              찾아요.
            </p>
            <ul className="s44">
              <li className="s45">
                <span className="s46">✦</span>
                <span>층별 평면도 전환과 공간별 확대</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>내 팀 영역만 모아 보기</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>확대하면 동료의 상태 메시지가 말풍선으로</span>
              </li>
            </ul>
          </div>
          <div className="s47">
            <div className="s48">
              <img src="assets/floor-2f.png" alt="2F 평면도" className="s49" />
              {hm.chars.map((ch, index) => (
                <React.Fragment key={ch.label ?? index}>
                  <div style={ch.style}>
                    <img src={ch.img} className="s50" alt="" />
                  </div>
                </React.Fragment>
              ))}
              {hm.bubbles.map((bb, index) => (
                <React.Fragment key={bb.label ?? index}>
                  <span style={bb.style}>
                    <img src={bb.icon} className="s51" alt="" />
                    {bb.text}
                  </span>
                </React.Fragment>
              ))}
            </div>
            <div className="s52">
              <span className="s53">2F</span>
              <span className="s54">3F</span>
            </div>
          </div>
        </div>
        <div className="s40">
          <div className="s55">
            <div className="s56">
              <b className="s57">팀원 목록</b>
              <div className="s58">
                <span className="s59">
                  <img src={hm.minsu} className="s60" alt="" />
                </span>
                <span className="s61">
                  <span className="s62">
                    <b className="s63">최민수</b>
                    <span className="s7"></span>
                    <span className="s64">출근</span>
                  </span>
                  <span className="s65">
                    <img src="assets/icons/mute.png" className="s66" alt="" />
                    지금 소리에 예민해요
                  </span>
                </span>
              </div>
              <div className="s67">
                <span className="s59">
                  <img src={hm.haeun} className="s60" alt="" />
                </span>
                <span className="s61">
                  <span className="s62">
                    <b className="s63">정하은</b>
                    <span className="s7"></span>
                    <span className="s64">출근</span>
                  </span>
                  <span className="s68">
                    <img src="assets/icons/focus.png" className="s66" alt="" />
                    집중하고 있어요
                  </span>
                </span>
              </div>
              <div className="s67">
                <span className="s59">
                  <img src={hm.seoyeon} className="s60" alt="" />
                </span>
                <span className="s61">
                  <span className="s62">
                    <b className="s63">박서연</b>
                    <span className="s7"></span>
                    <span className="s69">식사</span>
                  </span>
                  <span className="s68">
                    <img src="assets/icons/lunch.png" className="s66" alt="" />
                    식사하러 갔어요
                  </span>
                </span>
              </div>
              <div className="s67">
                <span className="s59">
                  <img src={hm.jihun} className="s60" alt="" />
                </span>
                <span className="s61">
                  <span className="s62">
                    <b className="s63">박지훈</b>
                    <span className="s7"></span>
                    <span className="s69">외근</span>
                  </span>
                  <span className="s68">
                    <img
                      src="assets/icons/outside.png"
                      className="s66"
                      alt=""
                    />
                    16시 복귀 예정
                  </span>
                </span>
              </div>
            </div>
            <div className="s70">
              <div className="s71">
                <span className="s72">
                  <img src={hm.minsu} className="s73" alt="" />
                </span>
                <span className="s74">
                  <b className="s75">최민수님의 감각</b>
                  <span className="s76">3F · B-1</span>
                </span>
              </div>
              <div className="s77">
                <div className="s78">
                  <img src="assets/icons/noise.png" className="s79" alt="" />
                  <span className="s80">소음</span>
                  <span className="s81">
                    <span className="s82"></span>
                    <span className="s82"></span>
                    <span className="s82"></span>
                    <span className="s82"></span>
                    <span className="s82"></span>
                  </span>
                  <span className="s83">매우 시끄러움</span>
                </div>
                <div className="s78">
                  <img src="assets/icons/temp.png" className="s79" alt="" />
                  <span className="s80">온도</span>
                  <span className="s81">
                    <span className="s84"></span>
                    <span className="s84"></span>
                    <span className="s84"></span>
                    <span className="s85"></span>
                    <span className="s85"></span>
                  </span>
                  <span className="s86">적당</span>
                </div>
                <div className="s78">
                  <img src="assets/icons/humid.png" className="s79" alt="" />
                  <span className="s80">습도</span>
                  <span className="s81">
                    <span className="s87"></span>
                    <span className="s87"></span>
                    <span className="s85"></span>
                    <span className="s85"></span>
                    <span className="s85"></span>
                  </span>
                  <span className="s86">건조</span>
                </div>
                <div className="s78">
                  <img src="assets/icons/smell.png" className="s79" alt="" />
                  <span className="s80">냄새</span>
                  <span className="s81">
                    <span className="s88"></span>
                    <span className="s88"></span>
                    <span className="s85"></span>
                    <span className="s85"></span>
                    <span className="s85"></span>
                  </span>
                  <span className="s86">약함</span>
                </div>
              </div>
              <div className="s89">
                키보드·통화 소리에 특히 예민해요. 근처 통화는 짧게 부탁드려요.
              </div>
            </div>
          </div>
          <div className="s41">
            <span className="s42">02</span>
            <h3 className="s43">상태와 감각을 한눈에</h3>
            <p className="s29">
              출근·자리 비움·퇴근 상태와 함께 지금 느끼는 소음, 온도, 습도,
              냄새, 혼잡도를 5단계로 남겨요. 감각 카드에는 평소 예민한 감각도
              적어둘 수 있어요.
            </p>
            <ul className="s44">
              <li className="s45">
                <span className="s46">✦</span>
                <span>원클릭 빠른 상태 설정 (커피, 점심, 도움 요청 …)</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>시각·청각·후각 민감도를 담은 감각 카드</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>불쾌 지수는 온도·습도로 자동 계산</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="s40">
          <div className="s41">
            <span className="s42">03</span>
            <h3 className="s43">공간별 감각 히트맵</h3>
            <p className="s29">
              같은 공간에 있는 사람들의 감각을 자동으로 모아 공간마다 평균을
              보여줘요. 지금 조용한 자리, 덜 붐비는 라운지를 찾아 바로 이동할 수
              있어요.
            </p>
            <ul className="s44">
              <li className="s45">
                <span className="s46">✦</span>
                <span>청각·후각·온도·습도·혼잡도 히트맵</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>공간 카드: 인원, 수용 인원, 응답 수, 갱신 시각</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>최근 1시간 데이터만 반영</span>
              </li>
            </ul>
          </div>
          <div className="s90">
            <div className="s91">
              <span className="s92">
                <img src="assets/icons/ear.png" className="s66" alt="" />
                청각
              </span>
              <span className="s93">
                <img src="assets/icons/nose.png" className="s66" alt="" />
                후각
              </span>
              <span className="s93">
                <img src="assets/icons/temp.png" className="s66" alt="" />
                온도
              </span>
              <span className="s93">
                <img src="assets/icons/humid.png" className="s66" alt="" />
                습도
              </span>
              <span className="s93">
                <img src="assets/icons/crowd.png" className="s66" alt="" />
                혼잡도
              </span>
            </div>
            <div className="s94">
              <img src="assets/floor-2f.png" alt="" className="s49" />
              <div className="s95"></div>
              <div className="s96"></div>
              <div className="s97"></div>
              <div className="s98"></div>
              <div className="s99">
                <span className="s100">2F 발표실 › 하단 업무석</span>
                <b className="s63">소음 평균 4.3</b>
                <span className="s81">
                  <span className="s101"></span>
                  <span className="s101"></span>
                  <span className="s101"></span>
                  <span className="s101"></span>
                  <span className="s102"></span>
                </span>
                <span className="s103">응답 6명 · 3분 전 갱신</span>
              </div>
            </div>
            <div className="s104">
              매우 조용<span className="s105"></span>매우 시끄러움
            </div>
          </div>
        </div>
        <div className="s40">
          <div className="s106">
            <div className="s107">
              <span className="s108">
                <img src={hm.jihun} className="s109" alt="" />
              </span>
              <span className="s110">
                <span className="s111">Senspace · 방금</span>
                <b className="s63">박지훈님이 출근했어요</b>
                <span className="s112">즐겨찾는 동료 · 3F 디자인팀 업무석</span>
              </span>
            </div>
            <div className="s113">
              <span className="s108">
                <img src={hm.minsu} className="s109" alt="" />
              </span>
              <span className="s110">
                <span className="s111">Senspace · 2분 전</span>
                <b className="s63">최민수님의 새 상태 메시지</b>
                <span className="s112">"지금 소리에 예민해요"</span>
              </span>
            </div>
            <div className="s107">
              <span className="s108">
                <img src={hm.seoyeon} className="s109" alt="" />
              </span>
              <span className="s110">
                <span className="s111">Senspace · 12분 전</span>
                <b className="s63">박서연님이 자리로 돌아왔어요</b>
              </span>
            </div>
            <div className="s114">
              <span className="s115">
                <b className="s75">즐겨찾기한 동료 상태 변경</b>
                <span className="s116">브라우저 알림으로 받기</span>
              </span>
              <span className="s117">
                <span className="s118"></span>
              </span>
            </div>
          </div>
          <div className="s41">
            <span className="s42">04</span>
            <h3 className="s43">놓치지 않는 상태 알림</h3>
            <p className="s29">
              즐겨찾는 동료가 출근하거나 자리로 돌아오면 바로 알려드려요. 받고
              싶은 알림만 골라서 브라우저 알림으로 받아요.
            </p>
            <ul className="s44">
              <li className="s45">
                <span className="s46">✦</span>
                <span>즐겨찾기한 동료의 상태 변경 알림</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>새 상태 메시지·도움 요청 알림</span>
              </li>
              <li className="s45">
                <span className="s46">✦</span>
                <span>집중 근무 중에는 알림 잠시 멈추기</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
