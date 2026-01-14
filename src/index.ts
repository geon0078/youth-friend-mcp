#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import express, { Request, Response } from "express";

// ============================================
// API 설정 (12개 API) - 환경변수에서 로드
// ============================================

// 환경변수 검증 함수
function getEnvVar(name: string, required: boolean = true): string {
  const value = process.env[name];
  if (required && !value) {
    console.error(`환경변수 ${name}이(가) 설정되지 않았습니다.`);
    return "";
  }
  return value || "";
}

// 온통청년 API (2개)
const YOUTH_POLICY_API = {
  url: "https://www.youthcenter.go.kr/go/ythip/getPlcy",
  apiKey: getEnvVar("YOUTH_POLICY_API_KEY"),
};

const YOUTH_CENTER_API = {
  url: "https://www.youthcenter.go.kr/go/ythip/getSpace",
  apiKey: getEnvVar("YOUTH_CENTER_API_KEY"),
};

// 고용24 API (5개 - 실제 사용되는 API만)
const WORK24_APIS = {
  채용정보: {
    url: "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do",
    apiKey: getEnvVar("WORK24_JOB_POSTING_API_KEY"),
  },
  강소기업: {
    url: "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo216L01.do",
    apiKey: getEnvVar("WORK24_SMALL_GIANT_API_KEY"),
  },
  직업정보: {
    url: "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo212L01.do",
    apiKey: getEnvVar("WORK24_JOB_INFO_API_KEY"),
  },
  국민내일배움카드: {
    url: "https://www.work24.go.kr/cm/openApi/call/hr/callOpenApiSvcInfo310L01.do",
    apiKey: getEnvVar("WORK24_TRAINING_CARD_API_KEY"),
  },
  구직자취업역량: {
    url: "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo217L01.do",
    apiKey: getEnvVar("WORK24_EMPLOYMENT_PROGRAM_API_KEY"),
  },
};

// ============================================
// 코드 매핑
// ============================================

const REGION_CODES: Record<string, string> = {
  서울: "11", 부산: "26", 대구: "27", 인천: "28",
  광주: "29", 대전: "30", 울산: "31", 세종: "36",
  경기: "41", 강원: "42", 충북: "43", 충남: "44",
  전북: "45", 전남: "46", 경북: "47", 경남: "48", 제주: "50",
};

const REGION_NAMES: Record<string, string> = {
  "11": "서울특별시", "26": "부산광역시", "27": "대구광역시", "28": "인천광역시",
  "29": "광주광역시", "30": "대전광역시", "31": "울산광역시", "36": "세종특별자치시",
  "41": "경기도", "42": "강원도", "43": "충청북도", "44": "충청남도",
  "45": "전라북도", "46": "전라남도", "47": "경상북도", "48": "경상남도", "50": "제주특별자치도",
};

const POLICY_CATEGORIES = ["일자리", "주거", "교육", "복지문화", "참여권리"];

const NCS_CATEGORIES: Record<string, string> = {
  "01": "사업관리", "02": "경영/회계/사무", "03": "금융/보험",
  "04": "교육/자연/사회과학", "05": "법률/경찰/소방/교도/국방",
  "06": "보건/의료", "07": "사회복지/종교", "08": "문화/예술/디자인/방송",
  "09": "운전/운송", "10": "영업판매", "11": "경비/청소",
  "12": "이용/숙박/여행/오락/스포츠", "13": "음식서비스", "14": "건설",
  "15": "기계", "16": "재료", "17": "화학/바이오", "18": "섬유/의복",
  "19": "전기/전자", "20": "정보통신", "21": "식품가공",
  "22": "인쇄/목재/가구/공예", "23": "환경/에너지/안전", "24": "농림어업",
};

// ============================================
// 타입 정의
// ============================================

interface YouthPolicy {
  plcyNo: string;
  plcyNm: string;
  plcyExplnCn: string;
  plcyKywdNm: string;
  lclsfNm: string;
  mclsfNm: string;
  plcySprtCn: string;
  sprvsnInstCdNm: string;
  operInstCdNm: string;
  sprtTrgtMinAge: string;
  sprtTrgtMaxAge: string;
  sprtTrgtAgeLmtYn: string;
  earnCndSeCd: string;
  earnMinAmt: string;
  earnMaxAmt: string;
  earnEtcCn: string;
  mrgSttsCd: string;
  zipCd: string;
  plcyAplyMthdCn: string;
  aplyUrlAddr: string;
  bizPrdBgngYmd: string;
  bizPrdEndYmd: string;
  aplyYmd: string;
  inqCnt: string;
  addAplyQlfcCndCn: string;
  ptcpPrpTrgtCn: string;
  sbmsnDcmntCn: string;
  etcMttrCn: string;
  srngMthdCn: string;
  sprtSclCnt: string;
  refUrlAddr1: string;
  refUrlAddr2: string;
}

interface YouthCenter {
  cntrSn: string;
  cntrNm: string;
  cntrTelno: string;
  cntrAddr: string;
  cntrDaddr: string;
  cntrUrlAddr: string;
  stdgCtpvCd: string;
  stdgCtpvCdNm: string;
  stdgSggCd: string;
  stdgSggCdNm: string;
}

interface JobPosting {
  wantedAuthNo: string;
  company: string;
  title: string;
  salTpNm: string;
  sal: string;
  region: string;
  holidayTpNm: string;
  minEdubg: string;
  career: string;
  closeDt: string;
  wantedInfoUrl: string;
  jobsCd: string;
  empTpNm: string;
  workRegion: string;
}

interface SmallGiantCompany {
  enpBizrNo: string;
  enpNm: string;
  brndNm: string;
  ceoNm: string;
  indNm: string;
  addr: string;
  telNo: string;
  homepg: string;
  mnPrdct: string;
  empCnt: string;
  selYear: string;
}

interface JobInfo {
  jobCd: string;
  jobNm: string;
  jobClsfCd: string;
  jobClsfNm: string;
}

interface TrainingCourse {
  trprId: string;
  trprNm: string;
  trainstCstId: string;
  inoNm: string;
  trprChap: string;
  trprDegr: string;
  traStartDate: string;
  traEndDate: string;
  trainTarget: string;
  trainTargetCd: string;
  address: string;
  telNo: string;
  courseMan: string;
  realMan: string;
  yardMan: string;
  eiEmplRate3: string;
  grade: string;
  ncsYn: string;
  ncsCd: string;
  ncsNm: string;
}

interface EmploymentProgram {
  orgNm: string;
  pgmNm: string;
  crseNm: string;
  trgterIndvdlNm: string;
  crseStdt: string;
  crseEnddt: string;
  crseBgngHm: string;
  crseHr: string;
  holdPlc: string;
}

interface ApiResponse<T> {
  resultCode: number;
  resultMessage: string;
  result: {
    pagging: {
      totCount: number;
      pageNum: number;
      pageSize: number;
    };
    youthPolicyList: T[];
  };
}

// ============================================
// XML 파싱 유틸리티
// ============================================

function parseXmlValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tag}>|<${tag}>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? (match[1] || match[2] || '').trim() : '';
}

function parseXmlItems(xml: string, itemTag: string): string[] {
  const regex = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)</${itemTag}>`, 'gi');
  const matches = xml.match(regex);
  return matches || [];
}

// ============================================
// API 호출 함수
// ============================================

// 온통청년 API
async function fetchYouthPolicies(params: Record<string, string>): Promise<ApiResponse<YouthPolicy>> {
  const searchParams = new URLSearchParams({
    apiKeyNm: YOUTH_POLICY_API.apiKey,
    rtnType: "json",
    ...params,
  });

  const response = await fetch(`${YOUTH_POLICY_API.url}?${searchParams}`);
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);
  const data = await response.json();
  if (data.resultCode !== 200) throw new Error(`API 오류: ${data.resultMessage}`);
  return data;
}

async function fetchYouthCenters(params: Record<string, string>): Promise<ApiResponse<YouthCenter>> {
  const searchParams = new URLSearchParams({
    apiKeyNm: YOUTH_CENTER_API.apiKey,
    rtnType: "json",
    ...params,
  });

  const response = await fetch(`${YOUTH_CENTER_API.url}?${searchParams}`);
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);
  const data = await response.json();
  if (data.resultCode !== 200) throw new Error(`API 오류: ${data.resultMessage}`);
  return data;
}

// 고용24 채용정보 API
async function fetchJobPostings(params: Record<string, string>): Promise<JobPosting[]> {
  const searchParams = new URLSearchParams({
    authKey: WORK24_APIS.채용정보.apiKey,
    returnType: "XML",
    callTp: "L",
    ...params,
  });

  const response = await fetch(`${WORK24_APIS.채용정보.url}?${searchParams}`);
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);

  const xml = await response.text();
  const items = parseXmlItems(xml, 'wanted');

  return items.map(item => ({
    wantedAuthNo: parseXmlValue(item, 'wantedAuthNo'),
    company: parseXmlValue(item, 'company'),
    title: parseXmlValue(item, 'title'),
    salTpNm: parseXmlValue(item, 'salTpNm'),
    sal: parseXmlValue(item, 'sal'),
    region: parseXmlValue(item, 'region'),
    holidayTpNm: parseXmlValue(item, 'holidayTpNm'),
    minEdubg: parseXmlValue(item, 'minEdubg'),
    career: parseXmlValue(item, 'career'),
    closeDt: parseXmlValue(item, 'closeDt'),
    wantedInfoUrl: parseXmlValue(item, 'wantedInfoUrl'),
    jobsCd: parseXmlValue(item, 'jobsCd'),
    empTpNm: parseXmlValue(item, 'empTpNm'),
    workRegion: parseXmlValue(item, 'workRegion'),
  }));
}

// 고용24 강소기업 API
async function fetchSmallGiantCompanies(params: Record<string, string>): Promise<SmallGiantCompany[]> {
  const searchParams = new URLSearchParams({
    authKey: WORK24_APIS.강소기업.apiKey,
    returnType: "XML",
    ...params,
  });

  const response = await fetch(`${WORK24_APIS.강소기업.url}?${searchParams}`);
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);

  const xml = await response.text();
  const items = parseXmlItems(xml, 'smallGiant');

  return items.map(item => ({
    enpBizrNo: parseXmlValue(item, 'enpBizrNo'),
    enpNm: parseXmlValue(item, 'enpNm'),
    brndNm: parseXmlValue(item, 'brndNm'),
    ceoNm: parseXmlValue(item, 'ceoNm'),
    indNm: parseXmlValue(item, 'indNm'),
    addr: parseXmlValue(item, 'addr'),
    telNo: parseXmlValue(item, 'telNo'),
    homepg: parseXmlValue(item, 'homepg'),
    mnPrdct: parseXmlValue(item, 'mnPrdct'),
    empCnt: parseXmlValue(item, 'empCnt'),
    selYear: parseXmlValue(item, 'selYear'),
  }));
}

// 고용24 직업정보 API
async function fetchJobInfo(params: Record<string, string>): Promise<JobInfo[]> {
  const searchParams = new URLSearchParams({
    authKey: WORK24_APIS.직업정보.apiKey,
    returnType: "XML",
    target: "JOBCD",
    ...params,
  });

  const response = await fetch(`${WORK24_APIS.직업정보.url}?${searchParams}`);
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);

  const xml = await response.text();
  const items = parseXmlItems(xml, 'jobInfo');

  return items.map(item => ({
    jobCd: parseXmlValue(item, 'jobCd'),
    jobNm: parseXmlValue(item, 'jobNm'),
    jobClsfCd: parseXmlValue(item, 'jobClsfCd'),
    jobClsfNm: parseXmlValue(item, 'jobClsfNm'),
  }));
}

// 고용24 훈련과정 API (국민내일배움카드)
async function fetchTrainingCourses(params: Record<string, string>): Promise<TrainingCourse[]> {
  const searchParams = new URLSearchParams({
    authKey: WORK24_APIS.국민내일배움카드.apiKey,
    returnType: "XML",
    outType: "1",
    ...params,
  });

  const response = await fetch(`${WORK24_APIS.국민내일배움카드.url}?${searchParams}`);
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);

  const xml = await response.text();
  const items = parseXmlItems(xml, 'scn_list');

  return items.map(item => ({
    trprId: parseXmlValue(item, 'trprId'),
    trprNm: parseXmlValue(item, 'trprNm'),
    trainstCstId: parseXmlValue(item, 'trainstCstId'),
    inoNm: parseXmlValue(item, 'inoNm'),
    trprChap: parseXmlValue(item, 'trprChap'),
    trprDegr: parseXmlValue(item, 'trprDegr'),
    traStartDate: parseXmlValue(item, 'traStartDate'),
    traEndDate: parseXmlValue(item, 'traEndDate'),
    trainTarget: parseXmlValue(item, 'trainTarget'),
    trainTargetCd: parseXmlValue(item, 'trainTargetCd'),
    address: parseXmlValue(item, 'address'),
    telNo: parseXmlValue(item, 'telNo'),
    courseMan: parseXmlValue(item, 'courseMan'),
    realMan: parseXmlValue(item, 'realMan'),
    yardMan: parseXmlValue(item, 'yardMan'),
    eiEmplRate3: parseXmlValue(item, 'eiEmplRate3'),
    grade: parseXmlValue(item, 'grade'),
    ncsYn: parseXmlValue(item, 'ncsYn'),
    ncsCd: parseXmlValue(item, 'ncsCd'),
    ncsNm: parseXmlValue(item, 'ncsNm'),
  }));
}

// 고용24 취업역량 프로그램 API
async function fetchEmploymentPrograms(params: Record<string, string>): Promise<EmploymentProgram[]> {
  const searchParams = new URLSearchParams({
    authKey: WORK24_APIS.구직자취업역량.apiKey,
    returnType: "XML",
    ...params,
  });

  const response = await fetch(`${WORK24_APIS.구직자취업역량.url}?${searchParams}`);
  if (!response.ok) throw new Error(`API 요청 실패: ${response.status}`);

  const xml = await response.text();
  const items = parseXmlItems(xml, 'empPgm');

  return items.map(item => ({
    orgNm: parseXmlValue(item, 'orgNm'),
    pgmNm: parseXmlValue(item, 'pgmNm'),
    crseNm: parseXmlValue(item, 'crseNm'),
    trgterIndvdlNm: parseXmlValue(item, 'trgterIndvdlNm'),
    crseStdt: parseXmlValue(item, 'crseStdt'),
    crseEnddt: parseXmlValue(item, 'crseEnddt'),
    crseBgngHm: parseXmlValue(item, 'crseBgngHm'),
    crseHr: parseXmlValue(item, 'crseHr'),
    holdPlc: parseXmlValue(item, 'holdPlc'),
  }));
}

// ============================================
// 포맷팅 함수
// ============================================

function formatPolicyBrief(policy: YouthPolicy): string {
  return [
    `### ${policy.plcyNm}`,
    `- **번호:** ${policy.plcyNo}`,
    `- **분류:** ${policy.lclsfNm} > ${policy.mclsfNm}`,
    `- **연령:** ${policy.sprtTrgtMinAge || "?"} ~ ${policy.sprtTrgtMaxAge || "?"}세`,
    `- **신청:** ${policy.aplyYmd || "상시"}`,
    policy.plcyExplnCn ? `- **설명:** ${policy.plcyExplnCn.substring(0, 100)}${policy.plcyExplnCn.length > 100 ? "..." : ""}` : "",
    ``,
  ].filter(line => line !== "").join("\n");
}

function formatPolicyDetailed(policy: YouthPolicy): string {
  const lines = [
    `## ${policy.plcyNm}`,
    ``,
    `**정책번호:** ${policy.plcyNo}`,
    `**분류:** ${policy.lclsfNm} > ${policy.mclsfNm}`,
    policy.plcyKywdNm ? `**키워드:** ${policy.plcyKywdNm}` : "",
    ``,
    `### 정책 설명`,
    policy.plcyExplnCn || "정보 없음",
    ``,
    `### 지원 내용`,
    policy.plcySprtCn || "정보 없음",
    ``,
    `### 지원 대상`,
    `- **지원연령:** ${policy.sprtTrgtMinAge || "제한없음"} ~ ${policy.sprtTrgtMaxAge || "제한없음"}세`,
    policy.addAplyQlfcCndCn ? `- **추가자격조건:** ${policy.addAplyQlfcCndCn}` : "",
    policy.ptcpPrpTrgtCn ? `- **참여대상:** ${policy.ptcpPrpTrgtCn}` : "",
    ``,
    `### 신청 정보`,
    `- **주관기관:** ${policy.sprvsnInstCdNm || "정보 없음"}`,
    `- **운영기관:** ${policy.operInstCdNm || "정보 없음"}`,
    `- **신청기간:** ${policy.aplyYmd || "상시"}`,
    `- **사업기간:** ${policy.bizPrdBgngYmd || "?"} ~ ${policy.bizPrdEndYmd || "?"}`,
    policy.sprtSclCnt ? `- **지원규모:** ${policy.sprtSclCnt}명` : "",
    ``,
    `### 신청 방법`,
    policy.plcyAplyMthdCn || "정보 없음",
    ``,
    policy.sbmsnDcmntCn ? `### 제출서류\n${policy.sbmsnDcmntCn}` : "",
    policy.srngMthdCn ? `### 심사방법\n${policy.srngMthdCn}` : "",
    policy.etcMttrCn ? `### 기타사항\n${policy.etcMttrCn}` : "",
    ``,
    policy.aplyUrlAddr ? `**신청 URL:** ${policy.aplyUrlAddr}` : "",
    policy.refUrlAddr1 ? `**참고 URL:** ${policy.refUrlAddr1}` : "",
    ``,
    `---`,
  ];
  return lines.filter(line => line !== "").join("\n");
}

function formatCenter(center: YouthCenter): string {
  return [
    `## ${center.cntrNm}`,
    ``,
    `- **센터번호:** ${center.cntrSn}`,
    `- **지역:** ${center.stdgCtpvCdNm} ${center.stdgSggCdNm}`,
    `- **주소:** ${center.cntrAddr} ${center.cntrDaddr || ""}`,
    `- **전화번호:** ${center.cntrTelno || "정보 없음"}`,
    center.cntrUrlAddr ? `- **홈페이지:** ${center.cntrUrlAddr}` : "",
    ``,
    `---`,
  ].filter(line => line !== "").join("\n");
}

function formatCenterBrief(center: YouthCenter): string {
  return [
    `### ${center.cntrNm}`,
    `- **주소:** ${center.cntrAddr}`,
    `- **전화:** ${center.cntrTelno || "정보 없음"}`,
    ``,
  ].join("\n");
}

function formatJobPosting(job: JobPosting): string {
  return [
    `### ${job.title}`,
    `- **회사:** ${job.company}`,
    `- **지역:** ${job.region || job.workRegion}`,
    `- **급여:** ${job.salTpNm} ${job.sal}`,
    `- **학력:** ${job.minEdubg}`,
    `- **경력:** ${job.career}`,
    `- **고용형태:** ${job.empTpNm}`,
    `- **마감일:** ${job.closeDt}`,
    job.wantedInfoUrl ? `- **상세보기:** ${job.wantedInfoUrl}` : "",
    ``,
  ].filter(line => line !== "").join("\n");
}

function formatSmallGiant(company: SmallGiantCompany): string {
  return [
    `### ${company.enpNm}`,
    company.brndNm ? `- **브랜드:** ${company.brndNm}` : "",
    `- **대표자:** ${company.ceoNm}`,
    `- **업종:** ${company.indNm}`,
    `- **주소:** ${company.addr}`,
    `- **연락처:** ${company.telNo}`,
    `- **상시근로자:** ${company.empCnt}명`,
    company.mnPrdct ? `- **주요생산품:** ${company.mnPrdct}` : "",
    company.homepg ? `- **홈페이지:** ${company.homepg}` : "",
    `- **선정연도:** ${company.selYear}`,
    ``,
  ].filter(line => line !== "").join("\n");
}

function formatTrainingCourse(course: TrainingCourse): string {
  return [
    `### ${course.trprNm}`,
    `- **훈련기관:** ${course.inoNm}`,
    `- **주소:** ${course.address}`,
    `- **훈련기간:** ${course.traStartDate} ~ ${course.traEndDate}`,
    `- **정원:** ${course.courseMan}명 (실제 ${course.realMan}명)`,
    course.eiEmplRate3 ? `- **취업률:** ${course.eiEmplRate3}%` : "",
    course.grade ? `- **만족도:** ${course.grade}점` : "",
    course.ncsNm ? `- **NCS분류:** ${course.ncsNm}` : "",
    `- **연락처:** ${course.telNo}`,
    ``,
  ].filter(line => line !== "").join("\n");
}

function formatEmploymentProgram(program: EmploymentProgram): string {
  return [
    `### ${program.pgmNm}`,
    `- **과정명:** ${program.crseNm}`,
    `- **고용센터:** ${program.orgNm}`,
    `- **대상:** ${program.trgterIndvdlNm}`,
    `- **기간:** ${program.crseStdt} ~ ${program.crseEnddt}`,
    `- **시간:** ${program.crseBgngHm} (${program.crseHr}시간)`,
    `- **장소:** ${program.holdPlc}`,
    ``,
  ].filter(line => line !== "").join("\n");
}

// 나이 필터링
function filterPoliciesByAge(policies: YouthPolicy[], age: number): YouthPolicy[] {
  return policies.filter(policy => {
    const minAge = parseInt(policy.sprtTrgtMinAge) || 0;
    const maxAge = parseInt(policy.sprtTrgtMaxAge) || 100;
    return age >= minAge && age <= maxAge;
  });
}

// 날짜 유틸리티
function getDateString(daysFromNow: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

// ============================================
// MCP 서버 생성
// ============================================

const server = new McpServer({
  name: "youth-friend-mcp",
  version: "3.0.0",
});

// ============================================
// 기본 검색 도구 (기존 14개)
// ============================================

// 도구 1: 청년정책 검색
server.tool(
  "search_youth_policies",
  "청년정책을 검색합니다. 키워드, 지역, 분류 등으로 검색할 수 있습니다.",
  {
    keyword: z.string().optional().describe("검색 키워드 (정책명에서 검색)"),
    region: z.string().optional().describe("지역명 또는 지역코드 (예: 서울, 부산, 11, 26)"),
    category: z.string().optional().describe("정책 대분류 (일자리, 주거, 교육, 복지문화, 참여권리)"),
    subcategory: z.string().optional().describe("정책 중분류"),
    pageNum: z.number().optional().default(1).describe("페이지 번호"),
    pageSize: z.number().optional().default(10).describe("페이지 크기 (최대 100)"),
  },
  async ({ keyword, region, category, subcategory, pageNum, pageSize }) => {
    try {
      const params: Record<string, string> = {
        pageNum: String(pageNum || 1),
        pageSize: String(Math.min(pageSize || 10, 100)),
        pageType: "1",
      };

      if (keyword) params.plcyNm = keyword;
      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      }
      if (category) params.lclsfNm = category;
      if (subcategory) params.mclsfNm = subcategory;

      const data = await fetchYouthPolicies(params);
      const policies = data.result.youthPolicyList || [];
      const totalCount = data.result.pagging.totCount;

      if (policies.length === 0) {
        return { content: [{ type: "text" as const, text: "검색 결과가 없습니다. 다른 검색 조건을 시도해보세요." }] };
      }

      const result = [
        `# 청년정책 검색 결과`,
        `총 **${totalCount}개** 중 ${policies.length}개 표시 (페이지 ${pageNum})`,
        ``,
        ...policies.map(formatPolicyBrief),
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 2: 청년정책 상세 조회
server.tool(
  "get_policy_detail",
  "정책번호로 청년정책의 상세 정보를 조회합니다.",
  {
    policyNo: z.string().describe("정책번호"),
  },
  async ({ policyNo }) => {
    try {
      const data = await fetchYouthPolicies({ plcyNo: policyNo, pageType: "2" });
      const policies = data.result.youthPolicyList || [];

      if (policies.length === 0) {
        return { content: [{ type: "text" as const, text: `정책번호 '${policyNo}'에 해당하는 정책을 찾을 수 없습니다.` }] };
      }

      const result = [
        `# 청년정책 상세 정보`,
        ``,
        formatPolicyDetailed(policies[0]),
        ``,
        `**조회수:** ${policies[0].inqCnt || 0}회`,
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 3: 청년센터 검색
server.tool(
  "search_youth_centers",
  "전국 청년센터를 검색합니다. 지역별로 검색할 수 있습니다.",
  {
    region: z.string().optional().describe("지역명 또는 시도코드 (예: 서울, 부산, 11, 26)"),
    sggCd: z.string().optional().describe("시군구코드"),
    pageNum: z.number().optional().default(1).describe("페이지 번호"),
    pageSize: z.number().optional().default(10).describe("페이지 크기"),
  },
  async ({ region, sggCd, pageNum, pageSize }) => {
    try {
      const params: Record<string, string> = {
        pageNum: String(pageNum || 1),
        pageSize: String(pageSize || 10),
      };

      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.ctpvCd = regionCode.substring(0, 2);
      }
      if (sggCd) params.sggCd = sggCd;

      const data = await fetchYouthCenters(params);
      const centers = data.result.youthPolicyList || [];
      const totalCount = data.result.pagging.totCount;

      if (centers.length === 0) {
        return { content: [{ type: "text" as const, text: "검색 결과가 없습니다. 다른 지역을 검색해보세요." }] };
      }

      const result = [
        `# 청년센터 검색 결과`,
        `총 **${totalCount}개** 중 ${centers.length}개 센터`,
        ``,
        ...centers.map(formatCenter),
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 4: 청년센터 상세 조회
server.tool(
  "get_center_detail",
  "센터 일련번호로 청년센터의 상세 정보를 조회합니다.",
  {
    centerSn: z.string().describe("센터 일련번호"),
  },
  async ({ centerSn }) => {
    try {
      const data = await fetchYouthCenters({ plcSn: centerSn });
      const centers = data.result.youthPolicyList || [];

      if (centers.length === 0) {
        return { content: [{ type: "text" as const, text: `센터 일련번호 '${centerSn}'에 해당하는 센터를 찾을 수 없습니다.` }] };
      }

      return { content: [{ type: "text" as const, text: `# 청년센터 상세 정보\n\n${formatCenter(centers[0])}` }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 5: 나이 기반 정책 추천
server.tool(
  "recommend_policies_by_age",
  "나이에 맞는 청년정책을 추천합니다.",
  {
    age: z.number().describe("나이 (만 나이)"),
    category: z.string().optional().describe("관심 분야 (일자리, 주거, 교육, 복지문화, 참여권리)"),
    region: z.string().optional().describe("지역명 또는 지역코드"),
    pageSize: z.number().optional().default(20).describe("검색할 정책 수"),
  },
  async ({ age, category, region, pageSize }) => {
    try {
      const params: Record<string, string> = {
        pageNum: "1",
        pageSize: String(Math.min(pageSize || 20, 100)),
        pageType: "1",
      };

      if (category) params.lclsfNm = category;
      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      }

      const data = await fetchYouthPolicies(params);
      const allPolicies = data.result.youthPolicyList || [];
      const eligiblePolicies = filterPoliciesByAge(allPolicies, age);

      if (eligiblePolicies.length === 0) {
        return { content: [{ type: "text" as const, text: `${age}세에 해당하는 정책을 찾을 수 없습니다.` }] };
      }

      const result = [
        `# ${age}세 맞춤 청년정책 추천`,
        ``,
        `총 ${allPolicies.length}개 정책 중 **${eligiblePolicies.length}개** 해당`,
        category ? `분야: ${category}` : "",
        region ? `지역: ${region}` : "",
        ``,
        ...eligiblePolicies.map(formatPolicyBrief),
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 6: 분류별 정책 조회
server.tool(
  "get_policies_by_category",
  "분류별로 청년정책을 조회합니다.",
  {
    category: z.enum(["일자리", "주거", "교육", "복지문화", "참여권리"]).describe("정책 대분류"),
    subcategory: z.string().optional().describe("정책 중분류"),
    region: z.string().optional().describe("지역명 또는 지역코드"),
    pageNum: z.number().optional().default(1).describe("페이지 번호"),
    pageSize: z.number().optional().default(10).describe("페이지 크기"),
  },
  async ({ category, subcategory, region, pageNum, pageSize }) => {
    try {
      const params: Record<string, string> = {
        pageNum: String(pageNum || 1),
        pageSize: String(Math.min(pageSize || 10, 100)),
        pageType: "1",
        lclsfNm: category,
      };

      if (subcategory) params.mclsfNm = subcategory;
      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      }

      const data = await fetchYouthPolicies(params);
      const policies = data.result.youthPolicyList || [];
      const totalCount = data.result.pagging.totCount;

      if (policies.length === 0) {
        return { content: [{ type: "text" as const, text: `'${category}' 분야의 정책을 찾을 수 없습니다.` }] };
      }

      const result = [
        `# ${category} 분야 청년정책`,
        subcategory ? `중분류: ${subcategory}` : "",
        `총 **${totalCount}개** 정책`,
        ``,
        ...policies.map(formatPolicyBrief),
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 7: 지역별 정책 조회
server.tool(
  "get_policies_by_region",
  "특정 지역의 청년정책을 조회합니다.",
  {
    region: z.string().describe("지역명 (서울, 부산 등) 또는 지역코드"),
    category: z.string().optional().describe("정책 분류 필터"),
    pageNum: z.number().optional().default(1).describe("페이지 번호"),
    pageSize: z.number().optional().default(15).describe("페이지 크기"),
  },
  async ({ region, category, pageNum, pageSize }) => {
    try {
      const regionCode = REGION_CODES[region] || region;
      const zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      const regionName = REGION_NAMES[regionCode.substring(0, 2)] || region;

      const params: Record<string, string> = {
        pageNum: String(pageNum || 1),
        pageSize: String(Math.min(pageSize || 15, 100)),
        pageType: "1",
        zipCd: zipCd,
      };

      if (category) params.lclsfNm = category;

      const data = await fetchYouthPolicies(params);
      const policies = data.result.youthPolicyList || [];
      const totalCount = data.result.pagging.totCount;

      if (policies.length === 0) {
        return { content: [{ type: "text" as const, text: `${regionName} 지역의 정책을 찾을 수 없습니다.` }] };
      }

      const result = [
        `# ${regionName} 청년정책`,
        `총 **${totalCount}개** 정책`,
        ``,
        ...policies.map(formatPolicyBrief),
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// ============================================
// 고용24 API 도구 (신규 10개)
// ============================================

// 도구 15: 채용정보 검색
server.tool(
  "search_job_postings",
  "워크넷 채용정보를 검색합니다. 지역, 직종, 학력, 경력 등으로 필터링 가능합니다.",
  {
    keyword: z.string().optional().describe("검색 키워드"),
    region: z.string().optional().describe("근무지역 (서울, 부산 등)"),
    career: z.enum(["N", "E", "Z"]).optional().describe("경력 (N:신입, E:경력, Z:관계없음)"),
    education: z.string().optional().describe("학력코드 (00:학력무관, 01:초졸, 02:중졸, 03:고졸, 04:대졸2~3, 05:대졸4, 06:석사, 07:박사)"),
    salaryType: z.enum(["D", "H", "M", "Y"]).optional().describe("임금형태 (D:일급, H:시급, M:월급, Y:연봉)"),
    employmentType: z.string().optional().describe("고용형태코드"),
    startPage: z.number().optional().default(1).describe("시작 페이지"),
    display: z.number().optional().default(10).describe("출력 건수 (최대 100)"),
  },
  async ({ keyword, region, career, education, salaryType, employmentType, startPage, display }) => {
    try {
      const params: Record<string, string> = {
        startPage: String(startPage || 1),
        display: String(Math.min(display || 10, 100)),
      };

      if (keyword) params.keyword = keyword;
      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.region = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      }
      if (career) params.career = career;
      if (education) params.education = education;
      if (salaryType) params.salTp = salaryType;
      if (employmentType) params.empTp = employmentType;

      const jobs = await fetchJobPostings(params);

      if (jobs.length === 0) {
        return { content: [{ type: "text" as const, text: "검색 결과가 없습니다. 다른 조건으로 검색해보세요." }] };
      }

      const result = [
        `# 채용정보 검색 결과`,
        `총 ${jobs.length}건`,
        keyword ? `키워드: ${keyword}` : "",
        region ? `지역: ${region}` : "",
        ``,
        ...jobs.map(formatJobPosting),
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 16: 강소기업 검색
server.tool(
  "search_small_giant_companies",
  "청년친화강소기업을 검색합니다.",
  {
    region: z.string().optional().describe("기업 소재지역 (서울, 부산 등)"),
    startPage: z.number().optional().default(1).describe("시작 페이지"),
    display: z.number().optional().default(10).describe("출력 건수"),
  },
  async ({ region, startPage, display }) => {
    try {
      const params: Record<string, string> = {
        startPage: String(startPage || 1),
        display: String(display || 10),
      };

      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.region = regionCode;
      }

      const companies = await fetchSmallGiantCompanies(params);

      if (companies.length === 0) {
        return { content: [{ type: "text" as const, text: "검색 결과가 없습니다." }] };
      }

      const result = [
        `# 청년친화강소기업 검색 결과`,
        `총 ${companies.length}개 기업`,
        region ? `지역: ${region}` : "",
        ``,
        ...companies.map(formatSmallGiant),
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 17: 직업정보 검색
server.tool(
  "search_job_info",
  "직업정보를 검색합니다. 키워드 또는 조건으로 검색 가능합니다.",
  {
    keyword: z.string().optional().describe("직업명 키워드"),
    avgSalary: z.enum(["10", "20", "30", "40"]).optional().describe("평균연봉 (10:3천미만, 20:3~4천, 30:4~5천, 40:5천이상)"),
    prospect: z.enum(["1", "2", "3", "4", "5"]).optional().describe("직업전망 (1:증가, 2:다소증가, 3:유지, 4:다소감소, 5:감소)"),
  },
  async ({ keyword, avgSalary, prospect }) => {
    try {
      const params: Record<string, string> = {};

      if (keyword) {
        params.srchType = "K";
        params.keyword = keyword;
      } else {
        params.srchType = "C";
        if (avgSalary) params.avgSal = avgSalary;
        if (prospect) params.prospect = prospect;
      }

      const jobs = await fetchJobInfo(params);

      if (jobs.length === 0) {
        return { content: [{ type: "text" as const, text: "검색 결과가 없습니다." }] };
      }

      const result = [
        `# 직업정보 검색 결과`,
        `총 ${jobs.length}개 직업`,
        ``,
        ...jobs.map(job => [
          `### ${job.jobNm}`,
          `- **직업코드:** ${job.jobCd}`,
          `- **분류:** ${job.jobClsfNm}`,
          ``,
        ].join("\n")),
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 18: 훈련과정 검색 (국민내일배움카드)
server.tool(
  "search_training_courses",
  "국민내일배움카드 훈련과정을 검색합니다.",
  {
    region: z.string().optional().describe("훈련지역 (서울, 부산 등)"),
    ncsCode: z.string().optional().describe("NCS 대분류코드 (01~24)"),
    keyword: z.string().optional().describe("훈련과정명 키워드"),
    trainingType: z.string().optional().describe("훈련유형 (C0061:일반, C0054:국가기간, C0104:K-디지털)"),
    startDate: z.string().optional().describe("훈련시작일 From (YYYYMMDD)"),
    endDate: z.string().optional().describe("훈련시작일 To (YYYYMMDD)"),
    pageNum: z.number().optional().default(1).describe("페이지 번호"),
    pageSize: z.number().optional().default(10).describe("출력 건수"),
  },
  async ({ region, ncsCode, keyword, trainingType, startDate, endDate, pageNum, pageSize }) => {
    try {
      const today = getDateString();
      const threeMonthsLater = getDateString(90);

      const params: Record<string, string> = {
        pageNum: String(pageNum || 1),
        pageSize: String(pageSize || 10),
        srchTraStDt: startDate || today,
        srchTraEndDt: endDate || threeMonthsLater,
        sort: "DESC",
        sortCol: "2",
      };

      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.srchTraArea1 = regionCode.substring(0, 2);
      }
      if (ncsCode) params.srchNcs1 = ncsCode;
      if (keyword) params.srchTraNm = keyword;
      if (trainingType) params.crseTracseSe = trainingType;

      const courses = await fetchTrainingCourses(params);

      if (courses.length === 0) {
        return { content: [{ type: "text" as const, text: "검색 결과가 없습니다. 다른 조건으로 검색해보세요." }] };
      }

      const result = [
        `# 훈련과정 검색 결과`,
        `총 ${courses.length}개 과정`,
        region ? `지역: ${region}` : "",
        ``,
        ...courses.map(formatTrainingCourse),
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 19: 취업역량 프로그램 검색
server.tool(
  "search_employment_programs",
  "고용센터 취업역량 강화프로그램을 검색합니다.",
  {
    startPage: z.number().optional().default(1).describe("시작 페이지"),
    display: z.number().optional().default(10).describe("출력 건수"),
  },
  async ({ startPage, display }) => {
    try {
      const params: Record<string, string> = {
        startPage: String(startPage || 1),
        display: String(display || 10),
      };

      const programs = await fetchEmploymentPrograms(params);

      if (programs.length === 0) {
        return { content: [{ type: "text" as const, text: "검색 결과가 없습니다." }] };
      }

      const result = [
        `# 취업역량 강화프로그램 검색 결과`,
        `총 ${programs.length}개 프로그램`,
        ``,
        ...programs.map(formatEmploymentProgram),
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// ============================================
// 통합 검색 도구 (브레인스토밍 아이디어 구현)
// ============================================

// 도구 20: 지역 기반 올인원 검색 (아이디어 #6)
server.tool(
  "search_region_all",
  "지역 기반으로 정책, 센터, 채용, 훈련, 강소기업을 통합 검색합니다.",
  {
    region: z.string().describe("지역명 (서울, 부산 등)"),
    limit: z.number().optional().default(5).describe("각 항목별 표시 개수"),
  },
  async ({ region, limit }) => {
    try {
      const regionCode = REGION_CODES[region] || region;
      const ctpvCd = regionCode.substring(0, 2);
      const zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      const regionName = REGION_NAMES[ctpvCd] || region;
      const limitNum = limit || 5;

      // 병렬 API 호출
      const [policyData, centerData, jobs, companies] = await Promise.all([
        fetchYouthPolicies({ pageNum: "1", pageSize: String(limitNum), pageType: "1", zipCd }),
        fetchYouthCenters({ pageNum: "1", pageSize: String(limitNum), ctpvCd }),
        fetchJobPostings({ startPage: "1", display: String(limitNum), region: zipCd }).catch(() => []),
        fetchSmallGiantCompanies({ startPage: "1", display: String(limitNum), region: regionCode }).catch(() => []),
      ]);

      const policies = policyData.result.youthPolicyList || [];
      const centers = centerData.result.youthPolicyList || [];

      const result = [
        `# ${regionName} 통합 검색 결과`,
        ``,
        `## 청년정책 (${policyData.result.pagging.totCount}개)`,
        policies.length > 0 ? policies.map(formatPolicyBrief).join("\n") : "_해당 지역 정책이 없습니다._",
        ``,
        `## 청년센터 (${centerData.result.pagging.totCount}개)`,
        centers.length > 0 ? centers.map(formatCenterBrief).join("\n") : "_해당 지역 센터가 없습니다._",
        ``,
        `## 채용정보`,
        jobs.length > 0 ? jobs.map(formatJobPosting).join("\n") : "_해당 지역 채용정보가 없습니다._",
        ``,
        `## 청년친화강소기업`,
        companies.length > 0 ? companies.map(formatSmallGiant).join("\n") : "_해당 지역 강소기업 정보가 없습니다._",
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 21: 강소기업 + 정책 매칭 (아이디어 #3)
server.tool(
  "match_company_with_policies",
  "강소기업 정보와 관련 청년정책을 함께 제공합니다.",
  {
    region: z.string().optional().describe("지역명 (서울, 부산 등)"),
    limit: z.number().optional().default(5).describe("표시할 기업 수"),
  },
  async ({ region, limit }) => {
    try {
      const params: Record<string, string> = {
        startPage: "1",
        display: String(limit || 5),
      };

      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.region = regionCode;
      }

      const companies = await fetchSmallGiantCompanies(params);

      // 일자리 관련 정책 조회
      const policyData = await fetchYouthPolicies({
        pageNum: "1",
        pageSize: "5",
        pageType: "1",
        lclsfNm: "일자리",
      });
      const policies = policyData.result.youthPolicyList || [];

      if (companies.length === 0) {
        return { content: [{ type: "text" as const, text: "강소기업 검색 결과가 없습니다." }] };
      }

      const result = [
        `# 강소기업 + 청년정책 매칭`,
        region ? `지역: ${region}` : "",
        ``,
        `## 청년친화강소기업 (${companies.length}개)`,
        ...companies.map(formatSmallGiant),
        ``,
        `---`,
        ``,
        `## 강소기업 취업 시 활용 가능한 청년정책`,
        ``,
        `> 아래 정책들은 중소/강소기업 취업 시 혜택을 받을 수 있습니다.`,
        ``,
        ...policies.map(formatPolicyBrief),
        ``,
        `**TIP:** 강소기업 취업 시 '청년내일채움공제', '중소기업취업청년 소득세 감면' 등의 혜택을 확인하세요!`,
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 22: 원스톱 생존키트 (아이디어 #1)
server.tool(
  "get_survival_kit",
  "청년 상황에 맞는 정책, 센터, 훈련 패키지를 한 번에 제공합니다.",
  {
    age: z.number().describe("나이 (만 나이)"),
    region: z.string().describe("지역명"),
    interest: z.enum(["일자리", "주거", "교육", "복지문화", "참여권리"]).optional().describe("관심 분야"),
  },
  async ({ age, region, interest }) => {
    try {
      const regionCode = REGION_CODES[region] || region;
      const ctpvCd = regionCode.substring(0, 2);
      const zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      const regionName = REGION_NAMES[ctpvCd] || region;

      const policyParams: Record<string, string> = {
        pageNum: "1",
        pageSize: "10",
        pageType: "1",
        zipCd,
      };
      if (interest) policyParams.lclsfNm = interest;

      const [policyData, centerData, programs] = await Promise.all([
        fetchYouthPolicies(policyParams),
        fetchYouthCenters({ pageNum: "1", pageSize: "3", ctpvCd }),
        fetchEmploymentPrograms({ startPage: "1", display: "3" }).catch(() => []),
      ]);

      const allPolicies = policyData.result.youthPolicyList || [];
      const eligiblePolicies = filterPoliciesByAge(allPolicies, age);
      const centers = centerData.result.youthPolicyList || [];

      const result = [
        `# ${age}세 ${regionName} 청년 생존키트`,
        ``,
        `## 맞춤 청년정책 (${eligiblePolicies.length}개)`,
        interest ? `관심분야: ${interest}` : "",
        ``,
        eligiblePolicies.length > 0
          ? eligiblePolicies.slice(0, 5).map(formatPolicyBrief).join("\n")
          : "_해당 조건의 정책이 없습니다._",
        ``,
        `## 가까운 청년센터`,
        centers.length > 0
          ? centers.map(formatCenterBrief).join("\n")
          : "_해당 지역 센터가 없습니다._",
        ``,
        `## 취업역량 프로그램`,
        Array.isArray(programs) && programs.length > 0
          ? programs.map(formatEmploymentProgram).join("\n")
          : "_현재 진행 중인 프로그램이 없습니다._",
        ``,
        `---`,
        `**다음 단계:** 청년센터를 방문하여 맞춤 상담을 받아보세요!`,
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// ============================================
// 기존 통합/유틸리티 도구 (업데이트)
// ============================================

// 도구 8: 통합 검색 (정책 + 센터) - 기존 유지
server.tool(
  "search_all",
  "청년정책과 청년센터를 동시에 검색합니다.",
  {
    region: z.string().describe("지역명 또는 지역코드"),
    category: z.string().optional().describe("정책 분류"),
    policyLimit: z.number().optional().default(5).describe("표시할 정책 수"),
    centerLimit: z.number().optional().default(5).describe("표시할 센터 수"),
  },
  async ({ region, category, policyLimit, centerLimit }) => {
    try {
      const regionCode = REGION_CODES[region] || region;
      const ctpvCd = regionCode.substring(0, 2);
      const zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      const regionName = REGION_NAMES[ctpvCd] || region;

      const policyParams: Record<string, string> = {
        pageNum: "1",
        pageSize: String(policyLimit || 5),
        pageType: "1",
        zipCd,
      };
      if (category) policyParams.lclsfNm = category;

      const [policyData, centerData] = await Promise.all([
        fetchYouthPolicies(policyParams),
        fetchYouthCenters({ pageNum: "1", pageSize: String(centerLimit || 5), ctpvCd }),
      ]);

      const policies = policyData.result.youthPolicyList || [];
      const centers = centerData.result.youthPolicyList || [];

      const result = [
        `# ${regionName} 통합 검색 결과`,
        ``,
        `## 청년정책 (${policyData.result.pagging.totCount}개 중 ${policies.length}개)`,
        policies.length > 0 ? policies.map(formatPolicyBrief).join("\n") : "_해당 지역 정책이 없습니다._",
        ``,
        `## 청년센터 (${centerData.result.pagging.totCount}개 중 ${centers.length}개)`,
        centers.length > 0 ? centers.map(formatCenterBrief).join("\n") : "_해당 지역 센터가 없습니다._",
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 9~14: 기존 도구들 유지 (정책 비교, 자격요건 체크, 키워드 검색, 통계, 도움말)
server.tool(
  "compare_policies",
  "여러 정책을 비교합니다.",
  { policyNos: z.array(z.string()).describe("비교할 정책번호 목록 (최대 5개)") },
  async ({ policyNos }) => {
    try {
      if (policyNos.length > 5) {
        return { content: [{ type: "text" as const, text: "최대 5개까지만 비교할 수 있습니다." }] };
      }

      const policies: YouthPolicy[] = [];
      for (const policyNo of policyNos) {
        const data = await fetchYouthPolicies({ plcyNo: policyNo, pageType: "2" });
        if (data.result.youthPolicyList.length > 0) {
          policies.push(data.result.youthPolicyList[0]);
        }
      }

      if (policies.length === 0) {
        return { content: [{ type: "text" as const, text: "비교할 정책을 찾을 수 없습니다." }] };
      }

      const comparisonTable = [
        `# 청년정책 비교`,
        ``,
        `| 항목 | ${policies.map(p => p.plcyNm.substring(0, 15)).join(" | ")} |`,
        `|------|${policies.map(() => "------").join("|")}|`,
        `| **분류** | ${policies.map(p => p.lclsfNm).join(" | ")} |`,
        `| **연령** | ${policies.map(p => `${p.sprtTrgtMinAge || "?"}-${p.sprtTrgtMaxAge || "?"}세`).join(" | ")} |`,
        `| **신청기간** | ${policies.map(p => p.aplyYmd || "상시").join(" | ")} |`,
        `| **주관기관** | ${policies.map(p => (p.sprvsnInstCdNm || "").substring(0, 10)).join(" | ")} |`,
      ].join("\n");

      return { content: [{ type: "text" as const, text: comparisonTable }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

server.tool(
  "check_policy_eligibility",
  "특정 정책에 대한 자격요건을 확인합니다.",
  {
    policyNo: z.string().describe("정책번호"),
    age: z.number().optional().describe("나이 (만 나이)"),
  },
  async ({ policyNo, age }) => {
    try {
      const data = await fetchYouthPolicies({ plcyNo: policyNo, pageType: "2" });
      const policies = data.result.youthPolicyList || [];

      if (policies.length === 0) {
        return { content: [{ type: "text" as const, text: `정책번호 '${policyNo}'를 찾을 수 없습니다.` }] };
      }

      const policy = policies[0];
      const minAge = parseInt(policy.sprtTrgtMinAge) || 0;
      const maxAge = parseInt(policy.sprtTrgtMaxAge) || 100;

      let ageEligibility = "확인 필요";
      if (age) {
        ageEligibility = (age >= minAge && age <= maxAge) ? "✅ 해당" : "❌ 미해당";
      }

      const result = [
        `# 자격요건 확인: ${policy.plcyNm}`,
        ``,
        `## 기본 요건`,
        `| 항목 | 조건 | ${age ? "판정" : ""} |`,
        `|------|------|${age ? "------|" : ""}`,
        `| 연령 | ${minAge}세 ~ ${maxAge}세 | ${age ? ageEligibility : ""} |`,
        ``,
        policy.addAplyQlfcCndCn ? `## 추가 자격조건\n${policy.addAplyQlfcCndCn}` : "",
        policy.ptcpPrpTrgtCn ? `## 참여 대상\n${policy.ptcpPrpTrgtCn}` : "",
        policy.earnEtcCn ? `## 소득 조건\n${policy.earnEtcCn}` : "",
        `## 신청 방법`,
        policy.plcyAplyMthdCn || "정보 없음",
        policy.sbmsnDcmntCn ? `## 제출 서류\n${policy.sbmsnDcmntCn}` : "",
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

server.tool(
  "search_policies_by_keyword",
  "키워드로 청년정책을 검색합니다.",
  {
    keywords: z.string().describe("검색 키워드"),
    region: z.string().optional().describe("지역 필터"),
    category: z.string().optional().describe("분류 필터"),
    pageSize: z.number().optional().default(15).describe("검색 결과 수"),
  },
  async ({ keywords, region, category, pageSize }) => {
    try {
      const params: Record<string, string> = {
        pageNum: "1",
        pageSize: String(Math.min(pageSize || 15, 100)),
        pageType: "1",
        plcyKywdNm: keywords,
      };

      if (region) {
        const regionCode = REGION_CODES[region] || region;
        params.zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      }
      if (category) params.lclsfNm = category;

      const data = await fetchYouthPolicies(params);
      const policies = data.result.youthPolicyList || [];

      if (policies.length === 0) {
        return { content: [{ type: "text" as const, text: `'${keywords}' 키워드로 검색된 정책이 없습니다.` }] };
      }

      const result = [
        `# 키워드 검색 결과: "${keywords}"`,
        `총 **${data.result.pagging.totCount}개** 정책`,
        ``,
        ...policies.map(formatPolicyBrief),
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

server.tool(
  "get_policy_statistics",
  "청년정책 통계를 조회합니다.",
  { type: z.enum(["category", "region"]).describe("통계 유형") },
  async ({ type }) => {
    try {
      if (type === "category") {
        const stats: Record<string, number> = {};
        for (const category of POLICY_CATEGORIES) {
          const data = await fetchYouthPolicies({ pageNum: "1", pageSize: "1", pageType: "1", lclsfNm: category });
          stats[category] = data.result.pagging.totCount;
        }

        const total = Object.values(stats).reduce((a, b) => a + b, 0);
        const result = [
          `# 분류별 청년정책 통계`,
          ``,
          `| 분류 | 정책 수 | 비율 |`,
          `|------|---------|------|`,
          ...Object.entries(stats).map(([cat, count]) =>
            `| ${cat} | ${count}개 | ${((count / total) * 100).toFixed(1)}% |`
          ),
          `| **총계** | **${total}개** | 100% |`,
        ].join("\n");

        return { content: [{ type: "text" as const, text: result }] };
      } else {
        const stats: Record<string, number> = {};
        for (const [name, code] of Object.entries(REGION_CODES)) {
          const data = await fetchYouthPolicies({ pageNum: "1", pageSize: "1", pageType: "1", zipCd: `${code}000` });
          stats[name] = data.result.pagging.totCount;
        }

        const result = [
          `# 지역별 청년정책 통계`,
          ``,
          `| 지역 | 정책 수 |`,
          `|------|---------|`,
          ...Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([region, count]) => `| ${region} | ${count}개 |`),
        ].join("\n");

        return { content: [{ type: "text" as const, text: result }] };
      }
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

server.tool(
  "get_center_statistics",
  "전국 청년센터 통계를 조회합니다.",
  {},
  async () => {
    try {
      const stats: Record<string, number> = {};
      for (const [name, code] of Object.entries(REGION_CODES)) {
        const data = await fetchYouthCenters({ pageNum: "1", pageSize: "1", ctpvCd: code });
        stats[name] = data.result.pagging.totCount;
      }

      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      const result = [
        `# 전국 청년센터 통계`,
        `**전국 총 ${total}개 청년센터**`,
        ``,
        `| 지역 | 센터 수 |`,
        `|------|---------|`,
        ...Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([region, count]) => `| ${region} | ${count}개 |`),
      ].join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 23: 도움말 (업데이트)
server.tool(
  "get_help",
  "청년친구 MCP v3.0 사용법과 기능을 안내합니다.",
  {},
  async () => {
    const helpText = [
      `# 청년친구 MCP v3.0 도움말`,
      ``,
      `## 사용 가능한 기능 (22개 도구)`,
      ``,
      `### 온통청년 - 정책/센터 (7개)`,
      `- **search_youth_policies**: 청년정책 검색`,
      `- **get_policy_detail**: 정책 상세 조회`,
      `- **search_youth_centers**: 청년센터 검색`,
      `- **get_center_detail**: 센터 상세 조회`,
      `- **recommend_policies_by_age**: 나이 기반 정책 추천`,
      `- **get_policies_by_category**: 분류별 정책 조회`,
      `- **get_policies_by_region**: 지역별 정책 조회`,
      ``,
      `### 고용24 - 채용/기업/훈련 (5개)`,
      `- **search_job_postings**: 워크넷 채용정보 검색`,
      `- **search_small_giant_companies**: 청년친화강소기업 검색`,
      `- **search_job_info**: 직업정보 검색`,
      `- **search_training_courses**: 국민내일배움카드 훈련과정 검색`,
      `- **search_employment_programs**: 취업역량 강화프로그램 검색`,
      ``,
      `### 통합 검색 (3개)`,
      `- **search_region_all**: 지역 기반 올인원 검색 (정책+센터+채용+강소기업)`,
      `- **match_company_with_policies**: 강소기업 + 정책 매칭`,
      `- **get_survival_kit**: 청년 생존키트 (맞춤 패키지)`,
      ``,
      `### 유틸리티 (7개)`,
      `- **search_all**: 정책+센터 통합 검색`,
      `- **compare_policies**: 정책 비교`,
      `- **check_policy_eligibility**: 자격요건 확인`,
      `- **search_policies_by_keyword**: 키워드 검색`,
      `- **get_policy_statistics**: 정책 통계`,
      `- **get_center_statistics**: 센터 통계`,
      `- **get_help**: 도움말`,
      ``,
      `## 지역코드`,
      `서울(11), 부산(26), 대구(27), 인천(28), 광주(29), 대전(30), 울산(31), 세종(36)`,
      `경기(41), 강원(42), 충북(43), 충남(44), 전북(45), 전남(46), 경북(47), 경남(48), 제주(50)`,
      ``,
      `## 정책분류`,
      `일자리, 주거, 교육, 복지문화, 참여권리`,
      ``,
      `## 사용 예시`,
      `- "서울 지역 정책, 센터, 채용정보 다 보여줘" → search_region_all`,
      `- "25세 서울 청년 생존키트" → get_survival_kit`,
      `- "강소기업 정보랑 관련 정책 같이 보여줘" → match_company_with_policies`,
      `- "IT 관련 훈련과정 검색해줘" → search_training_courses`,
    ].join("\n");

    return { content: [{ type: "text" as const, text: helpText }] };
  }
);

// ============================================
// 서버 시작
// ============================================

const isHttpMode = process.env.MCP_HTTP_MODE === "true" || process.env.PORT !== undefined;

async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("청년친구 MCP 서버 v3.0이 시작되었습니다. (stdio 모드, 22개 도구)");
}

async function startHttpServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // CORS 설정
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Session-Id");
    res.header("Access-Control-Expose-Headers", "Content-Type, X-Session-Id");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // 세션 관리
  const sessions: Map<string, { transport: SSEServerTransport; server: McpServer }> = new Map();

  // Health check
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: "3.0.0",
      tools: 22,
      activeSessions: sessions.size
    });
  });

  // SSE endpoint
  app.get("/sse", async (req: Request, res: Response) => {
    console.log("SSE 연결 요청 수신");

    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;

    console.log(`새 세션 생성: ${sessionId}`);

    // 세션 저장
    sessions.set(sessionId, { transport, server });

    res.on("close", () => {
      console.log(`세션 종료: ${sessionId}`);
      sessions.delete(sessionId);
    });

    try {
      await server.connect(transport);
    } catch (error) {
      console.error("SSE 연결 오류:", error);
      sessions.delete(sessionId);
    }
  });

  // Message endpoint (SSE 클라이언트가 POST로 메시지 전송)
  app.post("/message", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    console.log(`메시지 수신 - 세션: ${sessionId}`);

    const session = sessions.get(sessionId);
    if (!session) {
      console.error(`세션을 찾을 수 없음: ${sessionId}`);
      return res.status(404).json({
        error: "세션을 찾을 수 없습니다",
        sessionId,
        availableSessions: Array.from(sessions.keys())
      });
    }

    try {
      await session.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("메시지 처리 오류:", error);
      res.status(500).json({ error: "메시지 처리 중 오류 발생" });
    }
  });

  // MCP 메타데이터 엔드포인트 (PlayMCP 호환)
  app.get("/mcp", (req: Request, res: Response) => {
    res.json({
      name: "청년친구 MCP",
      version: "3.0.0",
      description: "청년정책, 청년센터, 고용24 정보 통합 제공 MCP 서버",
      transport: {
        type: "sse",
        endpoint: "/sse"
      },
      tools: 22
    });
  });

  // 루트 경로 - API 정보
  app.get("/", (req: Request, res: Response) => {
    res.json({
      name: "청년친구 MCP",
      version: "3.0.0",
      description: "청년정책, 청년센터, 고용24 정보 통합 제공",
      transport: "sse",
      endpoints: {
        mcp: "GET /mcp - MCP 메타데이터",
        health: "GET /health - 헬스체크",
        sse: "GET /sse - SSE 연결",
        message: "POST /message?sessionId=xxx - 메시지 전송"
      },
      tools: 22
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`청년친구 MCP 서버 v3.0이 시작되었습니다. (HTTP/SSE 모드, 포트: ${PORT})`);
    console.log(`SSE 엔드포인트: /sse`);
    console.log(`메시지 엔드포인트: /message`);
  });
}

// 모드에 따라 서버 시작
if (isHttpMode) {
  startHttpServer().catch((error) => {
    console.error("HTTP 서버 시작 실패:", error);
    process.exit(1);
  });
} else {
  startStdioServer().catch((error) => {
    console.error("Stdio 서버 시작 실패:", error);
    process.exit(1);
  });
}
