#!/usr/bin/env node

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express, { Request, Response } from "express";
import { randomUUID } from "crypto";

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
// 도구 등록 함수 (HTTP 모드용)
// ============================================

function registerAllTools(mcpServer: McpServer) {
  // 도구 1: 청년정책 검색
  mcpServer.tool(
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

  // 도구 2: 도움말
  mcpServer.tool(
    "get_help",
    "청년친구 MCP v3.0 사용법과 기능을 안내합니다.",
    {},
    async () => {
      const helpText = [
        `# 청년친구 MCP v3.0 도움말`,
        ``,
        `## 사용 가능한 기능 (22개 도구)`,
        ``,
        `### 온통청년 - 정책/센터`,
        `- search_youth_policies: 청년정책 검색`,
        `- get_policy_detail: 정책 상세 조회`,
        `- search_youth_centers: 청년센터 검색`,
        `- recommend_policies_by_age: 나이 기반 정책 추천`,
        ``,
        `### 고용24 - 채용/기업/훈련`,
        `- search_job_postings: 워크넷 채용정보 검색`,
        `- search_small_giant_companies: 청년친화강소기업 검색`,
        `- search_training_courses: 국민내일배움카드 훈련과정 검색`,
        ``,
        `### 통합 검색`,
        `- search_region_all: 지역 기반 올인원 검색`,
        `- get_survival_kit: 청년 생존키트 (맞춤 패키지)`,
      ].join("\n");

      return { content: [{ type: "text" as const, text: helpText }] };
    }
  );
}

// ============================================
// 기본 검색 도구 (기존 14개) - stdio 모드용
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

// ============================================
// 🚀 고급 통합 도구 (브레인스토밍 결과 TOP 8)
// ============================================

// 도구 24: 메가 통합 검색 (12개 API 전체)
server.tool(
  "mega_search",
  "키워드 하나로 정책, 센터, 채용, 훈련, 강소기업 등 모든 정보를 통합 검색합니다. 가장 강력한 검색 도구입니다.",
  {
    keyword: z.string().describe("검색 키워드 (예: IT, 주거, 창업, 취업)"),
    age: z.number().optional().describe("나이 (만 나이) - 입력 시 자격요건 자동 필터링"),
    region: z.string().optional().describe("지역명 (서울, 부산 등) - 입력 시 지역 필터링"),
    limit: z.number().optional().default(5).describe("각 항목별 최대 결과 수"),
  },
  async ({ keyword, age, region, limit }) => {
    try {
      const regionCode = region ? (REGION_CODES[region] || region) : undefined;
      const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;
      const limitNum = limit || 5;

      // 병렬 API 호출
      const [policyData, centerData, jobs, companies, courses, programs] = await Promise.all([
        fetchYouthPolicies({
          pageNum: "1",
          pageSize: String(limitNum * 2),
          pageType: "1",
          plcyNm: keyword,
          ...(zipCd && { zipCd })
        }).catch(() => ({ result: { youthPolicyList: [], pagging: { totCount: 0 } } })),
        fetchYouthCenters({
          pageNum: "1",
          pageSize: String(limitNum),
          ...(regionCode && { ctpvCd: regionCode.substring(0, 2) })
        }).catch(() => ({ result: { youthPolicyList: [], pagging: { totCount: 0 } } })),
        fetchJobPostings({
          startPage: "1",
          display: String(limitNum),
          keyword,
          ...(zipCd && { region: zipCd })
        }).catch(() => []),
        fetchSmallGiantCompanies({
          startPage: "1",
          display: String(limitNum),
          ...(regionCode && { region: regionCode })
        }).catch(() => []),
        fetchTrainingCourses({
          pageNum: "1",
          pageSize: String(limitNum),
          srchTraNm: keyword,
          srchTraStDt: getDateString(),
          srchTraEndDt: getDateString(90),
          ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
        }).catch(() => []),
        fetchEmploymentPrograms({ startPage: "1", display: String(limitNum) }).catch(() => []),
      ]);

      let policies = policyData.result.youthPolicyList || [];
      if (age) {
        policies = filterPoliciesByAge(policies, age);
      }
      const centers = centerData.result.youthPolicyList || [];

      const result = [
        `# 🔍 "${keyword}" 메가 통합 검색 결과`,
        age ? `**필터:** ${age}세` : "",
        region ? `**지역:** ${region}` : "",
        ``,
        `---`,
        ``,
        `## 📋 청년정책 (${policyData.result.pagging.totCount}개 중 ${policies.length}개)`,
        policies.length > 0 ? policies.slice(0, limitNum).map(formatPolicyBrief).join("\n") : "_검색 결과 없음_",
        ``,
        `## 🏢 청년센터 (${centerData.result.pagging.totCount}개)`,
        centers.length > 0 ? centers.map(formatCenterBrief).join("\n") : "_검색 결과 없음_",
        ``,
        `## 💼 채용정보 (${jobs.length}개)`,
        jobs.length > 0 ? jobs.map(formatJobPosting).join("\n") : "_검색 결과 없음_",
        ``,
        `## 🏆 청년친화강소기업 (${companies.length}개)`,
        companies.length > 0 ? companies.map(formatSmallGiant).join("\n") : "_검색 결과 없음_",
        ``,
        `## 📚 훈련과정 (${courses.length}개)`,
        courses.length > 0 ? courses.map(formatTrainingCourse).join("\n") : "_검색 결과 없음_",
        ``,
        `## 🎯 취업역량 프로그램 (${programs.length}개)`,
        Array.isArray(programs) && programs.length > 0 ? programs.map(formatEmploymentProgram).join("\n") : "_검색 결과 없음_",
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 25: 취업 풀패키지
server.tool(
  "employment_full_package",
  "목표 직종/직업을 입력하면 관련 채용정보, 필요 훈련, 지원 정책, 강소기업을 한번에 제공합니다.",
  {
    jobKeyword: z.string().describe("목표 직종/직업 키워드 (예: 개발자, 디자이너, 마케터, 요리사)"),
    region: z.string().optional().describe("희망 근무지역 (서울, 부산 등)"),
    age: z.number().optional().describe("나이 (만 나이) - 자격요건 필터링용"),
    career: z.enum(["N", "E", "Z"]).optional().default("N").describe("경력 (N:신입, E:경력, Z:무관)"),
  },
  async ({ jobKeyword, region, age, career }) => {
    try {
      const regionCode = region ? (REGION_CODES[region] || region) : undefined;
      const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

      // 병렬 API 호출
      const [jobs, companies, courses, policyData] = await Promise.all([
        fetchJobPostings({
          startPage: "1",
          display: "10",
          keyword: jobKeyword,
          career: career || "N",
          ...(zipCd && { region: zipCd })
        }).catch(() => []),
        fetchSmallGiantCompanies({
          startPage: "1",
          display: "5",
          ...(regionCode && { region: regionCode })
        }).catch(() => []),
        fetchTrainingCourses({
          pageNum: "1",
          pageSize: "10",
          srchTraNm: jobKeyword,
          srchTraStDt: getDateString(),
          srchTraEndDt: getDateString(90),
          ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
        }).catch(() => []),
        fetchYouthPolicies({
          pageNum: "1",
          pageSize: "10",
          pageType: "1",
          lclsfNm: "일자리",
          ...(zipCd && { zipCd })
        }).catch(() => ({ result: { youthPolicyList: [], pagging: { totCount: 0 } } })),
      ]);

      let policies = policyData.result.youthPolicyList || [];
      if (age) {
        policies = filterPoliciesByAge(policies, age);
      }

      const result = [
        `# 🎯 "${jobKeyword}" 취업 풀패키지`,
        ``,
        `**목표:** ${jobKeyword}`,
        region ? `**희망지역:** ${region}` : "",
        age ? `**나이:** ${age}세` : "",
        `**경력:** ${career === "N" ? "신입" : career === "E" ? "경력" : "무관"}`,
        ``,
        `---`,
        ``,
        `## 💼 Step 1: 채용정보 (${jobs.length}개)`,
        `> 현재 모집 중인 ${jobKeyword} 관련 채용공고`,
        ``,
        jobs.length > 0 ? jobs.map(formatJobPosting).join("\n") : "_현재 채용공고 없음_",
        ``,
        `## 📚 Step 2: 준비할 훈련과정 (${courses.length}개)`,
        `> ${jobKeyword} 취업을 위한 국비지원 훈련`,
        ``,
        courses.length > 0 ? courses.map(formatTrainingCourse).join("\n") : "_관련 훈련과정 없음_",
        ``,
        `## 📋 Step 3: 활용 가능한 정책 (${policies.length}개)`,
        `> 취업 시 혜택받을 수 있는 청년정책`,
        ``,
        policies.length > 0 ? policies.map(formatPolicyBrief).join("\n") : "_해당 정책 없음_",
        ``,
        `## 🏆 Step 4: 추천 강소기업 (${companies.length}개)`,
        `> 청년친화강소기업 - 복지 좋고 성장 가능한 기업`,
        ``,
        companies.length > 0 ? companies.map(formatSmallGiant).join("\n") : "_해당 지역 강소기업 없음_",
        ``,
        `---`,
        `**💡 TIP:** 강소기업 취업 시 '청년내일채움공제', '중소기업취업청년 소득세 감면' 혜택을 꼭 확인하세요!`,
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 26: 훈련→채용 브릿지 (NCS 기반)
server.tool(
  "training_job_bridge",
  "훈련과정 검색 후 해당 훈련과 연관된 채용정보를 NCS 코드 기반으로 자동 매칭합니다.",
  {
    trainingKeyword: z.string().describe("훈련과정 키워드 (예: 웹개발, 데이터분석, 요리, 용접)"),
    region: z.string().optional().describe("훈련/취업 희망 지역"),
    ncsCode: z.string().optional().describe("NCS 대분류코드 (01~24) - 직접 지정 시"),
  },
  async ({ trainingKeyword, region, ncsCode }) => {
    try {
      const regionCode = region ? (REGION_CODES[region] || region) : undefined;

      // 훈련과정 검색
      const courses = await fetchTrainingCourses({
        pageNum: "1",
        pageSize: "10",
        srchTraNm: trainingKeyword,
        srchTraStDt: getDateString(),
        srchTraEndDt: getDateString(90),
        ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) }),
        ...(ncsCode && { srchNcs1: ncsCode })
      }).catch(() => []);

      // NCS 코드 추출 (첫 번째 훈련과정에서)
      const extractedNcsCode = courses.length > 0 && courses[0].ncsCd
        ? courses[0].ncsCd.substring(0, 2)
        : ncsCode;

      const ncsName = extractedNcsCode ? (NCS_CATEGORIES[extractedNcsCode] || "기타") : "전체";

      // NCS 기반 채용정보 검색
      const jobs = await fetchJobPostings({
        startPage: "1",
        display: "10",
        keyword: trainingKeyword,
        ...(regionCode && { region: regionCode.length === 2 ? `${regionCode}000` : regionCode })
      }).catch(() => []);

      const result = [
        `# 🌉 훈련→채용 브릿지`,
        ``,
        `**검색 키워드:** ${trainingKeyword}`,
        region ? `**지역:** ${region}` : "",
        extractedNcsCode ? `**NCS 분류:** ${ncsName} (${extractedNcsCode})` : "",
        ``,
        `---`,
        ``,
        `## 📚 관련 훈련과정 (${courses.length}개)`,
        `> 국민내일배움카드로 수강 가능한 과정`,
        ``,
        courses.length > 0 ? courses.map(formatTrainingCourse).join("\n") : "_관련 훈련과정 없음_",
        ``,
        `---`,
        ``,
        `## 💼 연계 채용정보 (${jobs.length}개)`,
        `> 훈련 수료 후 지원 가능한 채용공고`,
        ``,
        jobs.length > 0 ? jobs.map(formatJobPosting).join("\n") : "_관련 채용정보 없음_",
        ``,
        `---`,
        `**💡 경로:** 훈련 수료 → 자격증 취득 → 채용 지원 → 취업 성공!`,
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 27: 맞춤 필터링 (프로필 기반)
server.tool(
  "personalized_recommendations",
  "나이, 지역, 관심분야, 취업상태를 입력하면 자격요건에 맞는 정책과 프로그램만 추천합니다.",
  {
    age: z.number().describe("나이 (만 나이)"),
    region: z.string().describe("거주 지역 (서울, 부산 등)"),
    category: z.enum(["일자리", "주거", "교육", "복지문화", "참여권리", "전체"]).optional().default("전체").describe("관심 분야"),
    employmentStatus: z.enum(["구직중", "재직중", "창업준비", "학생", "기타"]).optional().describe("현재 상태"),
    incomeLevel: z.enum(["무소득", "저소득", "중위소득", "일반"]).optional().describe("소득 수준"),
  },
  async ({ age, region, category, employmentStatus, incomeLevel }) => {
    try {
      const regionCode = REGION_CODES[region] || region;
      const zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      const ctpvCd = regionCode.substring(0, 2);
      const regionName = REGION_NAMES[ctpvCd] || region;

      const policyParams: Record<string, string> = {
        pageNum: "1",
        pageSize: "30",
        pageType: "1",
        zipCd,
      };
      if (category && category !== "전체") policyParams.lclsfNm = category;

      const [policyData, centerData, programs] = await Promise.all([
        fetchYouthPolicies(policyParams),
        fetchYouthCenters({ pageNum: "1", pageSize: "5", ctpvCd }),
        fetchEmploymentPrograms({ startPage: "1", display: "5" }).catch(() => []),
      ]);

      // 나이 필터링
      const eligiblePolicies = filterPoliciesByAge(policyData.result.youthPolicyList || [], age);
      const centers = centerData.result.youthPolicyList || [];

      // 상태별 추가 추천 메시지
      let statusTip = "";
      if (employmentStatus === "구직중") {
        statusTip = "💡 **구직자 추천:** 취업성공패키지, 국민취업지원제도를 우선 확인하세요!";
      } else if (employmentStatus === "창업준비") {
        statusTip = "💡 **창업준비생 추천:** 청년창업사관학교, 창업지원금 정책을 확인하세요!";
      } else if (employmentStatus === "학생") {
        statusTip = "💡 **학생 추천:** 국가장학금, 학자금대출, 인턴십 프로그램을 확인하세요!";
      }

      const result = [
        `# 🎯 ${age}세 ${regionName} 청년 맞춤 추천`,
        ``,
        `**프로필:**`,
        `- 나이: ${age}세`,
        `- 지역: ${regionName}`,
        category !== "전체" ? `- 관심분야: ${category}` : "",
        employmentStatus ? `- 현재상태: ${employmentStatus}` : "",
        incomeLevel ? `- 소득수준: ${incomeLevel}` : "",
        ``,
        statusTip,
        ``,
        `---`,
        ``,
        `## ✅ 자격요건 충족 정책 (${eligiblePolicies.length}개)`,
        `> 전체 ${policyData.result.pagging.totCount}개 중 ${age}세 지원 가능한 정책`,
        ``,
        eligiblePolicies.length > 0
          ? eligiblePolicies.slice(0, 10).map(formatPolicyBrief).join("\n")
          : "_해당 조건의 정책이 없습니다_",
        ``,
        `## 🏢 가까운 청년센터 (${centers.length}개)`,
        `> 방문 상담으로 더 자세한 안내를 받으세요`,
        ``,
        centers.length > 0 ? centers.map(formatCenterBrief).join("\n") : "_해당 지역 센터 없음_",
        ``,
        `## 🎯 취업역량 프로그램`,
        Array.isArray(programs) && programs.length > 0
          ? programs.map(formatEmploymentProgram).join("\n")
          : "_현재 진행 중인 프로그램 없음_",
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 28: 강소기업 취업 패키지 (강화)
server.tool(
  "small_giant_package",
  "강소기업 정보와 함께 취업 시 받을 수 있는 모든 혜택(정책, 지원금, 훈련)을 패키지로 제공합니다.",
  {
    region: z.string().optional().describe("지역명 (서울, 부산 등)"),
    industry: z.string().optional().describe("업종 키워드 (IT, 제조, 서비스 등)"),
    age: z.number().optional().describe("나이 (만 나이) - 정책 필터링용"),
  },
  async ({ region, industry, age }) => {
    try {
      const regionCode = region ? (REGION_CODES[region] || region) : undefined;
      const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

      const [companies, policyData, jobs] = await Promise.all([
        fetchSmallGiantCompanies({
          startPage: "1",
          display: "10",
          ...(regionCode && { region: regionCode })
        }),
        fetchYouthPolicies({
          pageNum: "1",
          pageSize: "15",
          pageType: "1",
          lclsfNm: "일자리",
          ...(zipCd && { zipCd })
        }),
        fetchJobPostings({
          startPage: "1",
          display: "5",
          ...(industry && { keyword: industry }),
          ...(zipCd && { region: zipCd })
        }).catch(() => []),
      ]);

      let policies = policyData.result.youthPolicyList || [];
      if (age) {
        policies = filterPoliciesByAge(policies, age);
      }

      // 강소기업 취업 관련 정책 키워드 필터
      const employmentPolicies = policies.filter(p =>
        p.plcyNm.includes("취업") || p.plcyNm.includes("채용") ||
        p.plcyNm.includes("일자리") || p.plcyNm.includes("내일채움") ||
        p.plcyNm.includes("소득세") || p.plcyNm.includes("중소기업")
      );

      const result = [
        `# 🏆 강소기업 취업 패키지`,
        ``,
        region ? `**지역:** ${region}` : "**지역:** 전국",
        industry ? `**업종:** ${industry}` : "",
        age ? `**나이:** ${age}세` : "",
        ``,
        `---`,
        ``,
        `## 🏢 청년친화강소기업 (${companies.length}개)`,
        `> 고용노동부 인증 - 급여, 복지, 성장성 우수 기업`,
        ``,
        companies.length > 0 ? companies.map(formatSmallGiant).join("\n") : "_해당 조건 기업 없음_",
        ``,
        `---`,
        ``,
        `## 💰 강소기업 취업 시 혜택 정책 (${employmentPolicies.length}개)`,
        ``,
        `### 🔥 핵심 혜택 안내`,
        `| 혜택 | 내용 |`,
        `|------|------|`,
        `| 청년내일채움공제 | 2년 근무 → 1,200만원+ 목돈 마련 |`,
        `| 소득세 감면 | 중소기업 취업 청년 5년간 90% 감면 |`,
        `| 전세자금 대출 | 중소기업 재직자 우대 금리 |`,
        ``,
        employmentPolicies.length > 0
          ? employmentPolicies.slice(0, 5).map(formatPolicyBrief).join("\n")
          : "_관련 정책 정보를 불러오는 중..._",
        ``,
        `## 💼 관련 채용공고 (${jobs.length}개)`,
        jobs.length > 0 ? jobs.map(formatJobPosting).join("\n") : "_현재 채용공고 없음_",
        ``,
        `---`,
        `**💡 강소기업 취업 = 안정성 + 성장성 + 정책 혜택!**`,
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 29: 긴급 모드 (마감 임박)
server.tool(
  "urgent_deadlines",
  "마감이 임박한 정책, 채용, 프로그램을 긴급도 순으로 보여줍니다. 놓치면 안 되는 기회!",
  {
    region: z.string().optional().describe("지역명 (서울, 부산 등)"),
    daysWithin: z.number().optional().default(7).describe("며칠 이내 마감 (기본: 7일)"),
    category: z.string().optional().describe("관심 분야 (일자리, 주거, 교육 등)"),
  },
  async ({ region, daysWithin, category }) => {
    try {
      const regionCode = region ? (REGION_CODES[region] || region) : undefined;
      const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;
      const days = daysWithin || 7;

      const policyParams: Record<string, string> = {
        pageNum: "1",
        pageSize: "30",
        pageType: "1",
        ...(zipCd && { zipCd }),
        ...(category && { lclsfNm: category }),
      };

      const [policyData, jobs, programs] = await Promise.all([
        fetchYouthPolicies(policyParams),
        fetchJobPostings({
          startPage: "1",
          display: "20",
          ...(zipCd && { region: zipCd })
        }).catch(() => []),
        fetchEmploymentPrograms({ startPage: "1", display: "10" }).catch(() => []),
      ]);

      const policies = policyData.result.youthPolicyList || [];

      // 마감일 기준 필터링 (실제로는 API에서 날짜 필드 확인 필요)
      const today = new Date();
      const deadlineDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

      // 채용정보 마감일 필터
      const urgentJobs = jobs.filter(job => {
        if (!job.closeDt) return false;
        const closeDate = new Date(job.closeDt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
        return closeDate <= deadlineDate && closeDate >= today;
      });

      const result = [
        `# 🚨 긴급! ${days}일 내 마감`,
        ``,
        region ? `**지역:** ${region}` : "",
        category ? `**분야:** ${category}` : "",
        `**기준일:** ${today.toISOString().split('T')[0]}`,
        `**마감기한:** ${deadlineDate.toISOString().split('T')[0]}까지`,
        ``,
        `---`,
        ``,
        `## ⏰ 마감 임박 채용공고 (${urgentJobs.length}개)`,
        ``,
        urgentJobs.length > 0
          ? urgentJobs.map(job => [
              `### 🔴 ${job.title}`,
              `- **회사:** ${job.company}`,
              `- **마감:** ${job.closeDt} ⚠️`,
              `- **지역:** ${job.region || job.workRegion}`,
              job.wantedInfoUrl ? `- **지원:** ${job.wantedInfoUrl}` : "",
              ``
            ].filter(l => l !== "").join("\n")).join("\n")
          : "_${days}일 내 마감 채용공고 없음_",
        ``,
        `## 📋 주요 청년정책 (${policies.length}개)`,
        `> 신청 기간을 꼭 확인하세요!`,
        ``,
        policies.length > 0
          ? policies.slice(0, 10).map(p => [
              `### ${p.plcyNm}`,
              `- **신청기간:** ${p.aplyYmd || "상시"}`,
              `- **분류:** ${p.lclsfNm}`,
              ``
            ].join("\n")).join("\n")
          : "_해당 정책 없음_",
        ``,
        `## 🎯 취업역량 프로그램`,
        Array.isArray(programs) && programs.length > 0
          ? programs.slice(0, 5).map(formatEmploymentProgram).join("\n")
          : "_현재 프로그램 없음_",
        ``,
        `---`,
        `**⚡ 지금 바로 신청하세요! 기회는 기다려주지 않습니다!**`,
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 30: 비용 제로 플랜
server.tool(
  "zero_cost_plan",
  "무료로 이용 가능한 정책, 국비지원 훈련, 무료 상담만 모아서 보여줍니다.",
  {
    region: z.string().describe("지역명 (서울, 부산 등)"),
    age: z.number().optional().describe("나이 (만 나이)"),
    interest: z.enum(["취업", "창업", "주거", "교육", "전체"]).optional().default("전체").describe("관심 분야"),
  },
  async ({ region, age, interest }) => {
    try {
      const regionCode = REGION_CODES[region] || region;
      const zipCd = regionCode.length === 2 ? `${regionCode}000` : regionCode;
      const ctpvCd = regionCode.substring(0, 2);
      const regionName = REGION_NAMES[ctpvCd] || region;

      const categoryMap: Record<string, string> = {
        "취업": "일자리",
        "창업": "일자리",
        "주거": "주거",
        "교육": "교육",
        "전체": ""
      };

      const policyParams: Record<string, string> = {
        pageNum: "1",
        pageSize: "20",
        pageType: "1",
        zipCd,
      };
      if (interest && interest !== "전체") {
        policyParams.lclsfNm = categoryMap[interest] || "";
      }

      const [policyData, centerData, courses, programs] = await Promise.all([
        fetchYouthPolicies(policyParams),
        fetchYouthCenters({ pageNum: "1", pageSize: "5", ctpvCd }),
        fetchTrainingCourses({
          pageNum: "1",
          pageSize: "10",
          srchTraArea1: ctpvCd,
          srchTraStDt: getDateString(),
          srchTraEndDt: getDateString(90),
        }).catch(() => []),
        fetchEmploymentPrograms({ startPage: "1", display: "5" }).catch(() => []),
      ]);

      let policies = policyData.result.youthPolicyList || [];
      if (age) {
        policies = filterPoliciesByAge(policies, age);
      }
      const centers = centerData.result.youthPolicyList || [];

      const result = [
        `# 💸 비용 제로 플랜`,
        ``,
        `**무료로 청년의 꿈을 응원합니다!**`,
        ``,
        `- **지역:** ${regionName}`,
        age ? `- **나이:** ${age}세` : "",
        interest !== "전체" ? `- **관심분야:** ${interest}` : "",
        ``,
        `---`,
        ``,
        `## 🆓 무료 청년정책 (${policies.length}개)`,
        `> 정부/지자체 지원으로 무료 혜택`,
        ``,
        policies.length > 0
          ? policies.slice(0, 8).map(formatPolicyBrief).join("\n")
          : "_해당 정책 없음_",
        ``,
        `## 📚 국비지원 훈련과정 (${courses.length}개)`,
        `> 국민내일배움카드로 무료 수강`,
        ``,
        courses.length > 0 ? courses.slice(0, 5).map(course => [
          `### ${course.trprNm}`,
          `- **기관:** ${course.inoNm}`,
          `- **기간:** ${course.traStartDate} ~ ${course.traEndDate}`,
          `- **💰 자부담:** 국비지원 (카드 발급 필요)`,
          course.eiEmplRate3 ? `- **취업률:** ${course.eiEmplRate3}%` : "",
          ``
        ].filter(l => l !== "").join("\n")).join("\n") : "_훈련과정 없음_",
        ``,
        `## 🏢 무료 상담 청년센터 (${centers.length}개)`,
        `> 방문/전화 상담 모두 무료!`,
        ``,
        centers.length > 0 ? centers.map(formatCenterBrief).join("\n") : "_센터 없음_",
        ``,
        `## 🎯 무료 취업 프로그램`,
        Array.isArray(programs) && programs.length > 0
          ? programs.map(formatEmploymentProgram).join("\n")
          : "_프로그램 없음_",
        ``,
        `---`,
        `**💡 TIP:** 국민내일배움카드는 HRD-Net(hrd.go.kr)에서 신청하세요!`,
      ].filter(line => line !== "").join("\n");

      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return { content: [{ type: "text" as const, text: `오류 발생: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true };
    }
  }
);

// 도구 31: 도움말 (업데이트)
server.tool(
  "get_help",
  "청년친구 MCP v3.1 사용법과 기능을 안내합니다.",
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

  // CORS 설정 및 Origin 검증 (MCP 2025-03-26 스펙 준수)
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    // Origin 검증 (MCP 스펙 보안 요구사항)
    if (origin) {
      const isAllowed = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin);
      if (!isAllowed) {
        console.warn(`Origin 거부: ${origin}`);
        return res.status(403).json({ error: "Origin not allowed" });
      }
      res.header("Access-Control-Allow-Origin", origin);
    } else {
      res.header("Access-Control-Allow-Origin", "*");
    }

    res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-ID");
    res.header("Access-Control-Expose-Headers", "Content-Type, Mcp-Session-Id");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Streamable HTTP Transport (Stateless mode - 2025-03-26 스펙)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless 모드
  });

  // MCP 서버에 transport 연결
  await server.connect(transport);

  // Health check
  app.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: "3.1.0",
      transport: "streamable-http",
      endpoint: "/mcp",
      protocolVersion: "2025-03-26"
    });
  });

  // MCP 엔드포인트 - POST /sse (JSON-RPC 직접 처리)
  app.post("/sse", async (req: Request, res: Response) => {
    const body = req.body;
    console.log("POST /sse - MCP 요청:", JSON.stringify(body));

    // JSON-RPC 요청 처리
    if (body.method === "initialize") {
      // initialize 응답
      return res.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: "youth-friend-mcp",
            version: "3.0.0"
          }
        }
      });
    }

    if (body.method === "initialized") {
      // initialized는 알림이므로 응답 없음
      return res.status(204).send();
    }

    // tools/call 처리
    if (body.method === "tools/call") {
      const { name, arguments: args } = body.params || {};
      console.log(`tools/call: ${name}`, args);

      try {
        let result: string;

        switch (name) {
          case "mega_search": {
            const { keyword, age, region, limit = 5 } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const [policyData, centerData, jobs, companies, courses] = await Promise.all([
              fetchYouthPolicies({
                pageNum: "1", pageSize: String(limit * 2), pageType: "1", plcyNm: keyword,
                ...(zipCd && { zipCd })
              }).catch(() => ({ result: { youthPolicyList: [], pagging: { totCount: 0 } } })),
              fetchYouthCenters({
                pageNum: "1", pageSize: String(limit),
                ...(regionCode && { ctpvCd: regionCode.substring(0, 2) })
              }).catch(() => ({ result: { youthPolicyList: [], pagging: { totCount: 0 } } })),
              fetchJobPostings({
                startPage: "1", display: String(limit), keyword,
                ...(zipCd && { region: zipCd })
              }).catch(() => []),
              fetchSmallGiantCompanies({
                startPage: "1", display: String(limit),
                ...(regionCode && { region: regionCode })
              }).catch(() => []),
              fetchTrainingCourses({
                pageNum: "1", pageSize: String(limit), srchTraNm: keyword,
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []),
            ]);

            let policies = policyData.result.youthPolicyList || [];
            if (age) policies = filterPoliciesByAge(policies, age);
            const centers = centerData.result.youthPolicyList || [];

            result = [
              `# 🔍 "${keyword}" 메가 통합 검색`,
              age ? `**필터:** ${age}세` : "", region ? `**지역:** ${region}` : "", "",
              `## 📋 청년정책 (${policies.length}개)`,
              policies.slice(0, limit).map(formatPolicyBrief).join("\n") || "_없음_", "",
              `## 🏢 청년센터 (${centers.length}개)`,
              centers.map(formatCenterBrief).join("\n") || "_없음_", "",
              `## 💼 채용정보 (${jobs.length}개)`,
              jobs.map(formatJobPosting).join("\n") || "_없음_", "",
              `## 🏆 강소기업 (${companies.length}개)`,
              companies.map(formatSmallGiant).join("\n") || "_없음_", "",
              `## 📚 훈련과정 (${courses.length}개)`,
              courses.map(formatTrainingCourse).join("\n") || "_없음_",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "employment_full_package": {
            const { jobKeyword, region, age, career = "N" } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const [jobs, policies, courses, companies] = await Promise.all([
              fetchJobPostings({
                startPage: "1", display: "10", keyword: jobKeyword, career,
                ...(zipCd && { region: zipCd })
              }).catch(() => []),
              fetchYouthPolicies({
                pageNum: "1", pageSize: "10", pageType: "1", plcyNm: jobKeyword,
                ...(zipCd && { zipCd })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchTrainingCourses({
                pageNum: "1", pageSize: "10", srchTraNm: jobKeyword,
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []),
              fetchSmallGiantCompanies({
                startPage: "1", display: "5",
                ...(regionCode && { region: regionCode })
              }).catch(() => []),
            ]);

            let pols = policies.result?.youthPolicyList || [];
            if (age) pols = filterPoliciesByAge(pols, age);

            result = [
              `# 💼 "${jobKeyword}" 취업 풀패키지`,
              region ? `**희망지역:** ${region}` : "", career === "N" ? "**경력:** 신입" : career === "E" ? "**경력:** 경력" : "", "",
              `## 🔎 채용정보 (${jobs.length}개)`,
              jobs.map(formatJobPosting).join("\n") || "_없음_", "",
              `## 📚 관련 훈련과정 (${courses.length}개)`,
              courses.map(formatTrainingCourse).join("\n") || "_없음_", "",
              `## 📋 지원 정책 (${pols.length}개)`,
              pols.slice(0, 5).map(formatPolicyBrief).join("\n") || "_없음_", "",
              `## 🏆 강소기업 (${companies.length}개)`,
              companies.map(formatSmallGiant).join("\n") || "_없음_",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "training_job_bridge": {
            const { trainingKeyword, region, ncsCode } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const courses = await fetchTrainingCourses({
              pageNum: "1", pageSize: "10", srchTraNm: trainingKeyword,
              srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
              ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) }),
              ...(ncsCode && { srchNcs1: ncsCode })
            }).catch(() => []);

            const ncsKeywords = courses.slice(0, 3).map((c: any) => c.trainNm || trainingKeyword);
            const jobs = await fetchJobPostings({
              startPage: "1", display: "10",
              keyword: ncsKeywords[0] || trainingKeyword,
              ...(zipCd && { region: zipCd })
            }).catch(() => []);

            result = [
              `# 🌉 훈련→채용 브릿지: "${trainingKeyword}"`,
              region ? `**지역:** ${region}` : "", "",
              `## 📚 관련 훈련과정 (${courses.length}개)`,
              courses.map(formatTrainingCourse).join("\n") || "_없음_", "",
              `## 💼 연계 채용정보 (${jobs.length}개)`,
              jobs.map(formatJobPosting).join("\n") || "_없음_",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "personalized_recommendations": {
            const { age, region, category, employmentStatus } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const [policyData, centerData, courses] = await Promise.all([
              fetchYouthPolicies({
                pageNum: "1", pageSize: "20", pageType: "1",
                ...(zipCd && { zipCd }),
                ...(category && category !== "전체" && { plcyTp: category })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchYouthCenters({
                pageNum: "1", pageSize: "5",
                ...(regionCode && { ctpvCd: regionCode.substring(0, 2) })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchTrainingCourses({
                pageNum: "1", pageSize: "5",
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []),
            ]);

            let policies = filterPoliciesByAge(policyData.result?.youthPolicyList || [], age);
            const centers = centerData.result?.youthPolicyList || [];

            result = [
              `# 🎯 ${age}세 ${region} 맞춤 추천`,
              employmentStatus ? `**상태:** ${employmentStatus}` : "", category ? `**관심분야:** ${category}` : "", "",
              `## 📋 맞춤 정책 (${policies.length}개)`,
              policies.slice(0, 10).map(formatPolicyBrief).join("\n") || "_없음_", "",
              `## 🏢 인근 청년센터 (${centers.length}개)`,
              centers.map(formatCenterBrief).join("\n") || "_없음_", "",
              `## 📚 추천 훈련 (${courses.length}개)`,
              courses.map(formatTrainingCourse).join("\n") || "_없음_",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "small_giant_package": {
            const { region, industry, includeJobPostings = true, includeTraining = true } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;

            const companies = await fetchSmallGiantCompanies({
              startPage: "1", display: "10",
              ...(regionCode && { region: regionCode })
            }).catch(() => []);

            let jobs: any[] = [], courses: any[] = [];
            if (includeJobPostings) {
              jobs = await fetchJobPostings({
                startPage: "1", display: "5", keyword: industry || "청년",
                ...(regionCode && { region: regionCode.length === 2 ? `${regionCode}000` : regionCode })
              }).catch(() => []);
            }
            if (includeTraining) {
              courses = await fetchTrainingCourses({
                pageNum: "1", pageSize: "5", srchTraGbn: "C",
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []);
            }

            result = [
              `# 🏆 강소기업 취업 패키지`,
              region ? `**지역:** ${region}` : "", industry ? `**업종:** ${industry}` : "", "",
              `## 🏆 청년친화강소기업 (${companies.length}개)`,
              companies.map(formatSmallGiant).join("\n") || "_없음_",
              includeJobPostings ? `\n## 💼 관련 채용 (${jobs.length}개)\n${jobs.map(formatJobPosting).join("\n") || "_없음_"}` : "",
              includeTraining ? `\n## 📚 일학습병행 (${courses.length}개)\n${courses.map(formatTrainingCourse).join("\n") || "_없음_"}` : "",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "urgent_deadlines": {
            const { region, daysLimit = 30, category } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const [policyData, courses] = await Promise.all([
              fetchYouthPolicies({
                pageNum: "1", pageSize: "30", pageType: "1",
                ...(zipCd && { zipCd }),
                ...(category && { plcyTp: category })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchTrainingCourses({
                pageNum: "1", pageSize: "20",
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(daysLimit),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []),
            ]);

            const now = new Date();
            const policies = (policyData.result?.youthPolicyList || [])
              .filter((p: any) => {
                if (!p.plcySprtTermCn) return false;
                const match = p.plcySprtTermCn.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
                if (!match) return false;
                const endDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
                const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return daysLeft > 0 && daysLeft <= daysLimit;
              })
              .slice(0, 10);

            result = [
              `# ⏰ 마감 임박 긴급 모드`,
              `**기준:** ${daysLimit}일 이내 마감`, region ? `**지역:** ${region}` : "", "",
              `## 📋 마감 임박 정책 (${policies.length}개)`,
              policies.map(formatPolicyBrief).join("\n") || "_마감 임박 정책 없음_", "",
              `## 📚 곧 시작 훈련 (${courses.length}개)`,
              courses.slice(0, 10).map(formatTrainingCourse).join("\n") || "_없음_",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "zero_cost_plan": {
            const { region, age, category, includeTraining = true, includeCenters = true } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const [policyData, centerData, courses] = await Promise.all([
              fetchYouthPolicies({
                pageNum: "1", pageSize: "30", pageType: "1",
                ...(zipCd && { zipCd }),
                ...(category && { plcyTp: category })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              includeCenters ? fetchYouthCenters({
                pageNum: "1", pageSize: "5",
                ...(regionCode && { ctpvCd: regionCode.substring(0, 2) })
              }).catch(() => ({ result: { youthPolicyList: [] } })) : Promise.resolve({ result: { youthPolicyList: [] } }),
              includeTraining ? fetchTrainingCourses({
                pageNum: "1", pageSize: "10", srchTraGbn: "C",
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []) : Promise.resolve([]),
            ]);

            let policies = (policyData.result?.youthPolicyList || [])
              .filter((p: any) => {
                const content = (p.plcySprtCn || "").toLowerCase();
                return content.includes("무료") || content.includes("국비") || content.includes("전액") || content.includes("지원금");
              });
            if (age) policies = filterPoliciesByAge(policies, age);
            const centers = centerData.result?.youthPolicyList || [];

            result = [
              `# 💰 비용 제로 플랜`,
              `**조건:** 무료/국비 지원만`, region ? `**지역:** ${region}` : "", age ? `**나이:** ${age}세` : "", "",
              `## 📋 무료 지원 정책 (${policies.length}개)`,
              policies.slice(0, 10).map(formatPolicyBrief).join("\n") || "_없음_",
              includeCenters ? `\n## 🏢 무료 상담 센터 (${centers.length}개)\n${centers.map(formatCenterBrief).join("\n") || "_없음_"}` : "",
              includeTraining ? `\n## 📚 국비 훈련 (${courses.length}개)\n${courses.map(formatTrainingCourse).join("\n") || "_없음_"}` : "",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "search_youth_policies": {
            const { keyword, region, category } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;
            const data = await fetchYouthPolicies({
              pageNum: "1", pageSize: "10", pageType: "1",
              ...(keyword && { plcyNm: keyword }), ...(zipCd && { zipCd }), ...(category && { plcyTp: category })
            });
            const policies = data.result?.youthPolicyList || [];
            result = `# 청년정책 검색 결과 (${policies.length}개)\n\n` + policies.map(formatPolicyBrief).join("\n");
            break;
          }

          case "get_policy_detail": {
            const { policyNo } = args || {};
            const data = await fetchYouthPolicies({ pageNum: "1", pageSize: "100", pageType: "1" });
            const policy = (data.result?.youthPolicyList || []).find((p: any) => p.plcyNo === policyNo);
            result = policy ? formatPolicyDetailed(policy) : "정책을 찾을 수 없습니다.";
            break;
          }

          case "search_youth_centers": {
            const { region } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const data = await fetchYouthCenters({
              pageNum: "1", pageSize: "20",
              ...(regionCode && { ctpvCd: regionCode.substring(0, 2) })
            });
            const centers = data.result?.youthPolicyList || [];
            result = `# 청년센터 검색 결과 (${centers.length}개)\n\n` + centers.map(formatCenterBrief).join("\n");
            break;
          }

          case "recommend_policies_by_age": {
            const { age, region } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;
            const data = await fetchYouthPolicies({
              pageNum: "1", pageSize: "50", pageType: "1", ...(zipCd && { zipCd })
            });
            const policies = filterPoliciesByAge(data.result?.youthPolicyList || [], age);
            result = `# ${age}세 맞춤 정책 (${policies.length}개)\n\n` + policies.slice(0, 10).map(formatPolicyBrief).join("\n");
            break;
          }

          case "search_job_postings": {
            const { keyword, region } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const jobs = await fetchJobPostings({
              startPage: "1", display: "10", ...(keyword && { keyword }),
              ...(regionCode && { region: regionCode.length === 2 ? `${regionCode}000` : regionCode })
            });
            result = `# 채용정보 검색 결과 (${jobs.length}개)\n\n` + jobs.map(formatJobPosting).join("\n");
            break;
          }

          case "search_small_giant_companies": {
            const { region } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const companies = await fetchSmallGiantCompanies({
              startPage: "1", display: "10", ...(regionCode && { region: regionCode })
            });
            result = `# 청년친화강소기업 (${companies.length}개)\n\n` + companies.map(formatSmallGiant).join("\n");
            break;
          }

          case "search_training_courses": {
            const { region, keyword } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const courses = await fetchTrainingCourses({
              pageNum: "1", pageSize: "10",
              srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
              ...(keyword && { srchTraNm: keyword }),
              ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
            });
            result = `# 훈련과정 검색 결과 (${courses.length}개)\n\n` + courses.map(formatTrainingCourse).join("\n");
            break;
          }

          case "search_region_all": {
            const { region } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const [policyData, centerData, jobs, companies, courses] = await Promise.all([
              fetchYouthPolicies({
                pageNum: "1", pageSize: "5", pageType: "1",
                ...(zipCd && { zipCd })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchYouthCenters({
                pageNum: "1", pageSize: "5",
                ...(regionCode && { ctpvCd: regionCode.substring(0, 2) })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchJobPostings({
                startPage: "1", display: "5",
                ...(zipCd && { region: zipCd })
              }).catch(() => []),
              fetchSmallGiantCompanies({
                startPage: "1", display: "5",
                ...(regionCode && { region: regionCode })
              }).catch(() => []),
              fetchTrainingCourses({
                pageNum: "1", pageSize: "5",
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []),
            ]);

            const policies = policyData.result?.youthPolicyList || [];
            const centers = centerData.result?.youthPolicyList || [];

            result = [
              `# 📍 ${region || "전국"} 지역 통합 검색`,
              `## 📋 청년정책 (${policies.length}개)`,
              policies.map(formatPolicyBrief).join("\n") || "_없음_", "",
              `## 🏢 청년센터 (${centers.length}개)`,
              centers.map(formatCenterBrief).join("\n") || "_없음_", "",
              `## 💼 채용정보 (${jobs.length}개)`,
              jobs.map(formatJobPosting).join("\n") || "_없음_", "",
              `## 🏆 강소기업 (${companies.length}개)`,
              companies.map(formatSmallGiant).join("\n") || "_없음_", "",
              `## 📚 훈련과정 (${courses.length}개)`,
              courses.map(formatTrainingCourse).join("\n") || "_없음_",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "get_survival_kit": {
            const { age, region } = args || {};
            const regionCode = region ? (REGION_CODES[region] || region) : undefined;
            const zipCd = regionCode ? (regionCode.length === 2 ? `${regionCode}000` : regionCode) : undefined;

            const [policyData, centerData, courses] = await Promise.all([
              fetchYouthPolicies({
                pageNum: "1", pageSize: "20", pageType: "1",
                ...(zipCd && { zipCd })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchYouthCenters({
                pageNum: "1", pageSize: "5",
                ...(regionCode && { ctpvCd: regionCode.substring(0, 2) })
              }).catch(() => ({ result: { youthPolicyList: [] } })),
              fetchTrainingCourses({
                pageNum: "1", pageSize: "5",
                srchTraStDt: getDateString(), srchTraEndDt: getDateString(90),
                ...(regionCode && { srchTraArea1: regionCode.substring(0, 2) })
              }).catch(() => []),
            ]);

            let policies = policyData.result?.youthPolicyList || [];
            if (age) policies = filterPoliciesByAge(policies, age);
            const centers = centerData.result?.youthPolicyList || [];

            result = [
              `# 🎒 ${age}세 ${region} 청년 생존키트`,
              `## 📋 맞춤 정책 (${policies.length}개)`,
              policies.slice(0, 10).map(formatPolicyBrief).join("\n") || "_없음_", "",
              `## 🏢 인근 청년센터 (${centers.length}개)`,
              centers.map(formatCenterBrief).join("\n") || "_없음_", "",
              `## 📚 추천 훈련과정 (${courses.length}개)`,
              courses.map(formatTrainingCourse).join("\n") || "_없음_",
            ].filter(l => l !== "").join("\n");
            break;
          }

          case "get_help": {
            result = `# 청년친구 MCP v3.1 도움말

## 🔥 통합 도구 (NEW!)
- **mega_search**: 키워드로 모든 API 통합 검색
- **employment_full_package**: 취업 풀패키지
- **training_job_bridge**: 훈련→채용 NCS 브릿지
- **personalized_recommendations**: 맞춤 필터링
- **small_giant_package**: 강소기업 패키지
- **urgent_deadlines**: 마감 임박 긴급모드
- **zero_cost_plan**: 비용 제로 플랜

## 기본 도구
- search_youth_policies, get_policy_detail
- search_youth_centers, recommend_policies_by_age
- search_job_postings, search_small_giant_companies
- search_training_courses`;
            break;
          }

          default:
            return res.json({
              jsonrpc: "2.0", id: body.id,
              error: { code: -32601, message: `Unknown tool: ${name}` }
            });
        }

        return res.json({
          jsonrpc: "2.0", id: body.id,
          result: { content: [{ type: "text", text: result }] }
        });
      } catch (error) {
        console.error("tools/call error:", error);
        return res.json({
          jsonrpc: "2.0", id: body.id,
          result: { content: [{ type: "text", text: `오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}` }], isError: true }
        });
      }
    }

    if (body.method === "tools/list") {
      // 도구 목록 반환
      return res.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          tools: [
            {
              name: "search_youth_policies",
              description: "청년정책을 검색합니다. 키워드, 지역, 분류 등으로 검색할 수 있습니다.",
              inputSchema: {
                type: "object",
                properties: {
                  keyword: { type: "string", description: "검색 키워드" },
                  region: { type: "string", description: "지역명 (서울, 부산 등)" },
                  category: { type: "string", description: "정책 분류 (일자리, 주거, 교육 등)" }
                }
              }
            },
            {
              name: "get_policy_detail",
              description: "정책번호로 청년정책의 상세 정보를 조회합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  policyNo: { type: "string", description: "정책번호" }
                },
                required: ["policyNo"]
              }
            },
            {
              name: "search_youth_centers",
              description: "전국 청년센터를 검색합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  region: { type: "string", description: "지역명" }
                }
              }
            },
            {
              name: "recommend_policies_by_age",
              description: "나이에 맞는 청년정책을 추천합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  age: { type: "number", description: "만 나이" },
                  region: { type: "string", description: "지역명" }
                },
                required: ["age"]
              }
            },
            {
              name: "search_job_postings",
              description: "워크넷 채용정보를 검색합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  keyword: { type: "string", description: "검색 키워드" },
                  region: { type: "string", description: "근무지역" }
                }
              }
            },
            {
              name: "search_small_giant_companies",
              description: "청년친화강소기업을 검색합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  region: { type: "string", description: "지역명" }
                }
              }
            },
            {
              name: "search_training_courses",
              description: "국민내일배움카드 훈련과정을 검색합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  region: { type: "string", description: "훈련지역" },
                  keyword: { type: "string", description: "과정명 키워드" }
                }
              }
            },
            {
              name: "search_region_all",
              description: "지역 기반으로 정책, 센터, 채용, 훈련, 강소기업을 통합 검색합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  region: { type: "string", description: "지역명" }
                },
                required: ["region"]
              }
            },
            {
              name: "get_survival_kit",
              description: "청년 상황에 맞는 정책, 센터, 훈련 패키지를 한 번에 제공합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  age: { type: "number", description: "만 나이" },
                  region: { type: "string", description: "지역명" }
                },
                required: ["age", "region"]
              }
            },
            {
              name: "mega_search",
              description: "키워드 하나로 정책, 센터, 채용, 훈련, 강소기업 등 모든 정보를 통합 검색합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  keyword: { type: "string", description: "검색 키워드" },
                  age: { type: "number", description: "나이 - 자격요건 자동 필터링" },
                  region: { type: "string", description: "지역명" },
                  limit: { type: "number", description: "각 항목별 최대 결과 수 (기본 5)" }
                },
                required: ["keyword"]
              }
            },
            {
              name: "employment_full_package",
              description: "목표 직종/직업을 입력하면 관련 채용정보, 필요 훈련, 지원 정책, 강소기업을 한번에 제공합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  jobKeyword: { type: "string", description: "목표 직종/직업 키워드" },
                  region: { type: "string", description: "희망 근무지역" },
                  age: { type: "number", description: "나이" },
                  career: { type: "string", description: "경력 구분 (N: 신입, E: 경력, Z: 무관)" }
                },
                required: ["jobKeyword"]
              }
            },
            {
              name: "training_job_bridge",
              description: "훈련과정 검색 후 해당 훈련과 연관된 채용정보를 NCS 코드 기반으로 자동 매칭합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  trainingKeyword: { type: "string", description: "훈련과정 키워드" },
                  region: { type: "string", description: "훈련/취업 희망 지역" },
                  ncsCode: { type: "string", description: "NCS 대분류코드" }
                },
                required: ["trainingKeyword"]
              }
            },
            {
              name: "personalized_recommendations",
              description: "나이, 지역, 관심분야, 취업상태를 입력하면 자격요건에 맞는 정책과 프로그램만 추천합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  age: { type: "number", description: "나이" },
                  region: { type: "string", description: "거주 지역" },
                  category: { type: "string", description: "관심 분야 (일자리, 주거, 교육, 복지문화, 참여권리, 전체)" },
                  employmentStatus: { type: "string", description: "취업 상태 (구직중, 재직중, 창업준비, 학생, 기타)" },
                  incomeLevel: { type: "string", description: "소득 수준 (무소득, 저소득, 중위소득, 일반)" }
                },
                required: ["age", "region"]
              }
            },
            {
              name: "small_giant_package",
              description: "강소기업과 연계된 청년정책, 채용정보, 일학습병행 프로그램을 패키지로 제공합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  region: { type: "string", description: "지역명" },
                  industry: { type: "string", description: "업종 키워드" },
                  includeJobPostings: { type: "boolean", description: "관련 채용정보 포함 여부" },
                  includeTraining: { type: "boolean", description: "일학습병행 과정 포함 여부" }
                }
              }
            },
            {
              name: "urgent_deadlines",
              description: "마감 임박한 정책, 훈련, 채용정보를 긴급도 순으로 정렬하여 제공합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  region: { type: "string", description: "지역명" },
                  daysLimit: { type: "number", description: "마감까지 남은 일수 (기본 30일)" },
                  category: { type: "string", description: "정책 분야 필터" }
                }
              }
            },
            {
              name: "zero_cost_plan",
              description: "무료/국비 지원 정책, 훈련, 프로그램만 필터링하여 비용 부담 없는 옵션을 제공합니다.",
              inputSchema: {
                type: "object",
                properties: {
                  region: { type: "string", description: "지역명" },
                  age: { type: "number", description: "나이" },
                  category: { type: "string", description: "관심 분야 (일자리, 주거, 교육, 복지문화)" },
                  includeTraining: { type: "boolean", description: "국비훈련 포함 여부" },
                  includeCenters: { type: "boolean", description: "무료 센터 상담 포함 여부" }
                }
              }
            },
            {
              name: "get_help",
              description: "청년친구 MCP v3.1 사용법과 기능을 안내합니다.",
              inputSchema: { type: "object", properties: {} }
            }
          ]
        }
      });
    }

    // 알 수 없는 메서드 (레거시 /sse 엔드포인트 - 새 /mcp 사용 권장)
    return res.json({
      jsonrpc: "2.0",
      id: body.id || null,
      error: {
        code: -32601,
        message: `Method not found: ${body.method}. Use /mcp endpoint instead.`
      }
    });
  });

  // MCP 엔드포인트 - /mcp (Streamable HTTP - 2025-03-26 스펙)
  app.all("/mcp", async (req: Request, res: Response) => {
    console.log(`${req.method} /mcp - MCP 요청`);

    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP 요청 처리 오류:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error" }
        });
      }
    }
  });

  // 루트 경로 - API 정보
  app.get("/", (req: Request, res: Response) => {
    res.json({
      name: "청년친구 MCP",
      version: "3.1.0",
      description: "청년정책, 청년센터, 고용24 정보 통합 제공",
      transport: "streamable-http",
      endpoint: "/mcp",
      protocolVersion: "2025-03-26",
      tools: 29
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`청년친구 MCP 서버 v3.1이 시작되었습니다. (Streamable HTTP, 포트: ${PORT})`);
    console.log(`MCP 엔드포인트: /mcp (Streamable HTTP)`);
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
