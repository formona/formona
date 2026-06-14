"use client";

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ChevronDown, Info, MapPin, Search } from 'lucide-react';
import { cn } from '../utils';
import { FlowProgress } from './FlowProgress';

interface AddressPageProps {
  initialValues?: AddressFormState;
  onValuesChange?: (values: AddressFormState) => void;
  onPrevious: () => void;
  onSubmit?: (values: AddressFormState) => Promise<void> | void;
}

type AddressFieldName = 'recipient' | 'phone' | 'postalCode' | 'baseAddress' | 'detailAddress' | 'deliveryMemo';

export type AddressFormState = Record<AddressFieldName, string>;
type RequiredAddressFieldName = Exclude<AddressFieldName, 'deliveryMemo'>;

interface KakaoPostcodeData {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: 'R' | 'J';
  bname: string;
  buildingName: string;
  apartment: 'Y' | 'N';
}

type KakaoPostcode = new (options: {
  oncomplete: (data: KakaoPostcodeData) => void;
  width?: string;
  height?: string;
}) => {
  open: (options?: {
    q?: string;
    popupTitle?: string;
    popupKey?: string;
    autoClose?: boolean;
  }) => void;
};

declare global {
  interface Window {
    kakao?: {
      Postcode: KakaoPostcode;
    };
  }
}

const ADDRESS_PLACEHOLDERS: AddressFormState = {
  recipient: '홍길동',
  phone: '010-1234-5678',
  postalCode: '주소 검색 후 자동 입력',
  baseAddress: '서울특별시 강남구 테헤란로 123',
  detailAddress: '101동 1203호',
  deliveryMemo: '문 앞에 놓아주세요',
};

const DELIVERY_MEMO_OPTIONS = [
  '문 앞에 놓아주세요',
  '경비실에 맡겨주세요',
  '배송 전 연락주세요',
  '직접 받을게요',
];

export const DEFAULT_ADDRESS_FORM_VALUES: AddressFormState = {
  recipient: '',
  phone: '',
  postalCode: '',
  baseAddress: '',
  detailAddress: '',
  deliveryMemo: DELIVERY_MEMO_OPTIONS[0],
};

const REQUIRED_FIELD_MESSAGES: Record<RequiredAddressFieldName, string> = {
  recipient: '받는 분을 입력해주세요.',
  phone: '연락처를 입력해주세요.',
  postalCode: '주소 검색으로 배송지를 선택해주세요.',
  baseAddress: '주소 검색으로 배송지를 선택해주세요.',
  detailAddress: '상세 주소를 입력해주세요.',
};

const PHONE_FORMAT_MESSAGE = '올바른 연락처 형식으로 입력해주세요.';
const RECIPIENT_FORMAT_MESSAGE = '받는 분은 한글, 영문, 공백만 입력해주세요.';
const RECIPIENT_LENGTH_MESSAGE = '받는 분은 2~30자로 입력해주세요.';
const DETAIL_ADDRESS_LENGTH_MESSAGE = '상세 주소는 100자 이하로 입력해주세요.';
const ADDRESS_RESELECT_MESSAGE = '주소가 변경되어 주소 검색을 다시 진행해주세요.';

const REQUIRED_FIELD_ORDER: RequiredAddressFieldName[] = [
  'recipient',
  'phone',
  'postalCode',
  'baseAddress',
  'detailAddress',
];

const REQUIRED_FIELD_GROUP_LABELS: Record<RequiredAddressFieldName, string> = {
  recipient: '받는 분',
  phone: '연락처',
  postalCode: '배송지 주소',
  baseAddress: '배송지 주소',
  detailAddress: '상세 주소',
};

const KAKAO_POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let kakaoPostcodeScriptPromise: Promise<void> | null = null;

const loadKakaoPostcodeScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window is unavailable'));
  }

  if (window.kakao?.Postcode) return Promise.resolve();
  if (kakaoPostcodeScriptPromise) return kakaoPostcodeScriptPromise;

  kakaoPostcodeScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = KAKAO_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.kakao?.Postcode) {
        resolve();
        return;
      }

      kakaoPostcodeScriptPromise = null;
      reject(new Error('Kakao postcode script loaded without API'));
    };
    script.onerror = () => {
      kakaoPostcodeScriptPromise = null;
      reject(new Error('Failed to load Kakao postcode script'));
    };
    document.head.appendChild(script);
  });

  return kakaoPostcodeScriptPromise;
};

const buildKakaoAddress = (data: KakaoPostcodeData) => {
  const selectedAddress = data.userSelectedType === 'R'
    ? data.roadAddress
    : data.jibunAddress;
  let extraAddress = '';

  if (data.userSelectedType === 'R') {
    if (data.bname && /[동로가]$/.test(data.bname)) {
      extraAddress += data.bname;
    }

    if (data.buildingName && data.apartment === 'Y') {
      extraAddress += extraAddress ? `, ${data.buildingName}` : data.buildingName;
    }
  }

  return `${selectedAddress || data.address}${extraAddress ? ` (${extraAddress})` : ''}`;
};

const PHONE_AREA_CODES = new Set([
  '031',
  '032',
  '033',
  '041',
  '042',
  '043',
  '044',
  '051',
  '052',
  '053',
  '054',
  '055',
  '061',
  '062',
  '063',
  '064',
]);
const PHONE_MOBILE_PREFIXES = new Set(['010', '011', '016', '017', '018', '019']);
const PHONE_SERVICE_PREFIXES = new Set(['050', '070', '080']);

const normalizePhoneDigits = (value: string) => value.replace(/\D/g, '');

const formatPhoneNumber = (value: string) => {
  const digits = normalizePhoneDigits(value).slice(0, 12);

  if (digits.startsWith('02')) {
    const body = digits.slice(2);
    if (body.length === 0) return '02';
    if (body.length <= 4) return `02-${body}`;

    return `02-${body.slice(0, body.length - 4)}-${body.slice(-4)}`;
  }

  if (/^050[2-8]/.test(digits) && digits.length > 4) {
    const body = digits.slice(4);
    if (body.length <= 4) return `${digits.slice(0, 4)}-${body}`;

    return `${digits.slice(0, 4)}-${body.slice(0, body.length - 4)}-${body.slice(-4)}`;
  }

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
};

const getPhoneValidationMessage = (value: string) => {
  const digits = normalizePhoneDigits(value);
  const prefix = digits.slice(0, 3);

  if (digits.length === 0) return REQUIRED_FIELD_MESSAGES.phone;
  if (digits.startsWith('02')) {
    return digits.length === 9 || digits.length === 10 ? null : PHONE_FORMAT_MESSAGE;
  }

  if (/^050[2-8]/.test(digits)) {
    return digits.length === 11 || digits.length === 12 ? null : PHONE_FORMAT_MESSAGE;
  }

  if (
    PHONE_MOBILE_PREFIXES.has(prefix)
    || PHONE_AREA_CODES.has(prefix)
    || PHONE_SERVICE_PREFIXES.has(prefix)
  ) {
    return digits.length === 10 || digits.length === 11 ? null : PHONE_FORMAT_MESSAGE;
  }

  return PHONE_FORMAT_MESSAGE;
};

const getRecipientValidationMessage = (value: string) => {
  const trimmedValue = value.trim().replace(/\s+/g, ' ');

  if (trimmedValue.length === 0) return REQUIRED_FIELD_MESSAGES.recipient;
  if (trimmedValue.length < 2 || trimmedValue.length > 30) return RECIPIENT_LENGTH_MESSAGE;
  if (!/^[가-힣a-zA-Z\s]+$/u.test(trimmedValue)) return RECIPIENT_FORMAT_MESSAGE;

  return null;
};

const getDetailAddressValidationMessage = (value: string) => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) return REQUIRED_FIELD_MESSAGES.detailAddress;
  if (trimmedValue.length > 100) return DETAIL_ADDRESS_LENGTH_MESSAGE;

  return null;
};

const FieldError = ({ id, message }: { id: string; message?: string }) => {
  if (!message) return null;

  return (
    <p id={id} className="mt-1.5 text-[11px] font-bold leading-snug text-main-brown" aria-live="polite">
      {message}
    </p>
  );
};

export function AddressPage({
  initialValues = DEFAULT_ADDRESS_FORM_VALUES,
  onValuesChange,
  onPrevious,
  onSubmit,
}: AddressPageProps) {
  const recipientRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const baseAddressRef = useRef<HTMLInputElement>(null);
  const detailAddressRef = useRef<HTMLInputElement>(null);
  const [formValues, setFormValues] = useState<AddressFormState>(initialValues);
  const [deliveryMemoOpen, setDeliveryMemoOpen] = useState(false);
  const [addressSearchMessage, setAddressSearchMessage] = useState<string | null>(null);
  const [isAddressSearchLoading, setIsAddressSearchLoading] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Partial<Record<RequiredAddressFieldName, string>>>({});
  const [orderCompleteOpen, setOrderCompleteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const invalidFieldNames = REQUIRED_FIELD_ORDER.filter((field) => Boolean(invalidFields[field]));
  const invalidFieldLabels = Array.from(new Set(
    invalidFieldNames.map((field) => REQUIRED_FIELD_GROUP_LABELS[field]),
  ));
  const hasInvalidFields = invalidFieldNames.length > 0;
  const addressSearchError = invalidFields.postalCode ?? invalidFields.baseAddress;
  const statusMessage = submitError
    ?? (hasInvalidFields
      ? `${invalidFieldLabels.join(', ')} 확인이 필요합니다.`
      : '입력한 배송지는 최종 주문 정보에 반영됩니다.');
  const statusHasAlert = Boolean(submitError) || hasInvalidFields;

  const updateFormValues = (resolveNextValues: (current: AddressFormState) => AddressFormState) => {
    setSubmitError(null);
    setFormValues((current) => {
      return resolveNextValues(current);
    });
  };

  useEffect(() => {
    onValuesChange?.(formValues);
  }, [formValues, onValuesChange]);

  const syncInvalidField = (name: RequiredAddressFieldName, message: string | null) => {
    setInvalidFields((current) => {
      const hasExistingMessage = Boolean(current[name]);

      if (!hasExistingMessage && !message) return current;

      const next = { ...current };

      if (message) {
        next[name] = message;
        return next;
      }

      delete next[name];
      return next;
    });
  };

  const updateField = (name: AddressFieldName, value: string) => {
    updateFormValues((current) => ({ ...current, [name]: value }));

    if (name === 'recipient') {
      syncInvalidField('recipient', getRecipientValidationMessage(value));
      return;
    }

    if (name === 'detailAddress') {
      syncInvalidField('detailAddress', getDetailAddressValidationMessage(value));
    }
  };
  const updatePhoneField = (value: string) => {
    const formattedPhone = formatPhoneNumber(value);

    updateFormValues((current) => ({ ...current, phone: formattedPhone }));
    setInvalidFields((current) => {
      if (!current.phone) return current;

      const next = { ...current };
      const phoneMessage = getPhoneValidationMessage(formattedPhone);

      if (phoneMessage) {
        next.phone = phoneMessage;
        return next;
      }

      delete next.phone;
      return next;
    });
  };
  const updateBaseAddressField = (value: string) => {
    const shouldResetSelectedAddress = formValues.postalCode.trim().length > 0 && value !== formValues.baseAddress;

    updateFormValues((current) => ({
      ...current,
      baseAddress: value,
      postalCode: shouldResetSelectedAddress ? '' : current.postalCode,
    }));
    setAddressSearchMessage(null);
    setInvalidFields((current) => {
      const next = { ...current };

      if (value.trim().length === 0) {
        next.baseAddress = REQUIRED_FIELD_MESSAGES.baseAddress;
      } else {
        delete next.baseAddress;
      }

      if (shouldResetSelectedAddress) {
        next.postalCode = ADDRESS_RESELECT_MESSAGE;
      }

      return next;
    });
  };
  const focusInvalidField = (name: RequiredAddressFieldName) => {
    const targetRef = (() => {
      if (name === 'recipient') return recipientRef;
      if (name === 'phone') return phoneRef;
      if (name === 'detailAddress') return detailAddressRef;
      return baseAddressRef;
    })();

    window.setTimeout(() => targetRef.current?.focus(), 0);
  };
  const searchAddress = async () => {
    const searchQuery = formValues.baseAddress.trim();
    setAddressSearchMessage(null);
    setIsAddressSearchLoading(true);

    try {
      await loadKakaoPostcodeScript();

      const postcode = new window.kakao!.Postcode({
        width: '100%',
        height: '100%',
        oncomplete: (data) => {
          updateFormValues((current) => ({
            ...current,
            postalCode: data.zonecode,
            baseAddress: buildKakaoAddress(data),
            detailAddress: current.detailAddress,
          }));
          setInvalidFields((current) => {
            if (!current.postalCode && !current.baseAddress) return current;

            const next = { ...current };
            delete next.postalCode;
            delete next.baseAddress;
            return next;
          });
          setAddressSearchMessage(null);
          window.setTimeout(() => detailAddressRef.current?.focus(), 0);
        },
      });

      postcode.open({
        ...(searchQuery ? { q: searchQuery } : {}),
        popupTitle: '배송지 주소 검색',
        popupKey: 'formona-address-search',
      });
    } catch {
      setAddressSearchMessage('주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsAddressSearchLoading(false);
    }
  };
  const completeOrder = async () => {
    if (isSubmitting) return;

    setSubmitError(null);

    const nextInvalidFields = REQUIRED_FIELD_ORDER.reduce<Partial<Record<RequiredAddressFieldName, string>>>(
      (fields, field) => {
        if (field === 'recipient') {
          const recipientMessage = getRecipientValidationMessage(formValues.recipient);

          if (recipientMessage) {
            fields.recipient = recipientMessage;
          }

          return fields;
        }

        if (field === 'phone') {
          const phoneMessage = getPhoneValidationMessage(formValues.phone);

          if (phoneMessage) {
            fields.phone = phoneMessage;
          }

          return fields;
        }

        if (field === 'detailAddress') {
          const detailAddressMessage = getDetailAddressValidationMessage(formValues.detailAddress);

          if (detailAddressMessage) {
            fields.detailAddress = detailAddressMessage;
          }

          return fields;
        }

        if (formValues[field].trim().length === 0) {
          fields[field] = REQUIRED_FIELD_MESSAGES[field];
        }

        return fields;
      },
      {},
    );
    const firstInvalidField = REQUIRED_FIELD_ORDER.find((field) => nextInvalidFields[field]);

    if (firstInvalidField) {
      setInvalidFields(nextInvalidFields);
      focusInvalidField(firstInvalidField);
      return;
    }

    setInvalidFields({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await onSubmit?.(formValues);
      setOrderCompleteOpen(true);
    } catch {
      setSubmitError('주문 정보를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-container address-page bg-white"
    >
      <div className="address-page-scroll">
        <form
          className="flow-card address-card flex w-full flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void completeOrder();
          }}
        >
          <FlowProgress currentStep={4} className="mx-auto mb-5" />

          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-main-brown/10 bg-white text-main-brown">
              <MapPin size={28} strokeWidth={1.9} aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-[25px] font-bold leading-tight text-main-brown">배송지 정보 입력</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-sub-gray">
              상품을 정확하게 받아보실 수 있도록<br />
              배송받을 주소를 입력해주세요.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-[58px_minmax(0,1fr)] items-start gap-3">
              <label htmlFor="recipient" className="pt-3 text-[13px] font-bold text-main-brown">받는 분</label>
              <div className="min-w-0">
                <input
                  id="recipient"
                  ref={recipientRef}
                  type="text"
                  autoComplete="name"
                  maxLength={30}
                  value={formValues.recipient}
                  onChange={(event) => updateField('recipient', event.target.value)}
                  placeholder={ADDRESS_PLACEHOLDERS.recipient}
                  aria-invalid={Boolean(invalidFields.recipient) || undefined}
                  aria-describedby={invalidFields.recipient ? 'recipient-error' : undefined}
                  className={cn(
                    "h-11 w-full min-w-0 rounded-lg border border-main-brown/10 bg-white px-4 text-[13px] font-medium text-main-brown outline-none placeholder:text-main-brown/65 focus:border-main-brown/45",
                    invalidFields.recipient && "border-main-brown/70 bg-main-brown/[0.05] shadow-[0_0_0_3px_rgba(79,44,29,0.08)]"
                  )}
                />
                <FieldError id="recipient-error" message={invalidFields.recipient} />
              </div>
            </div>

            <div className="grid grid-cols-[58px_minmax(0,1fr)] items-start gap-3">
              <label htmlFor="phone" className="pt-3 text-[13px] font-bold text-main-brown">연락처</label>
              <div className="min-w-0">
                <input
                  id="phone"
                  ref={phoneRef}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formValues.phone}
                  onChange={(event) => updatePhoneField(event.target.value)}
                  maxLength={14}
                  placeholder={ADDRESS_PLACEHOLDERS.phone}
                  aria-invalid={Boolean(invalidFields.phone) || undefined}
                  aria-describedby={invalidFields.phone ? 'phone-error' : undefined}
                  className={cn(
                    "h-11 w-full min-w-0 rounded-lg border border-main-brown/10 bg-white px-4 text-[13px] font-medium text-main-brown outline-none placeholder:text-main-brown/65 focus:border-main-brown/45",
                    invalidFields.phone && "border-main-brown/70 bg-main-brown/[0.05] shadow-[0_0_0_3px_rgba(79,44,29,0.08)]"
                  )}
                />
                <FieldError id="phone-error" message={invalidFields.phone} />
              </div>
            </div>

            <div className="grid grid-cols-[58px_minmax(0,1fr)] items-start gap-3">
              <label htmlFor="postal-code" className="pt-3 text-[13px] font-bold text-main-brown">우편번호</label>
              <div className="min-w-0">
                <input
                  id="postal-code"
                  type="text"
                  value={formValues.postalCode}
                  readOnly
                  placeholder={ADDRESS_PLACEHOLDERS.postalCode}
                  aria-invalid={Boolean(invalidFields.postalCode) || undefined}
                  aria-describedby={addressSearchError ? 'address-search-error' : undefined}
                  className={cn(
                    "h-11 w-full min-w-0 rounded-lg border border-main-brown/10 bg-main-brown/[0.03] px-4 text-[13px] font-medium text-main-brown outline-none placeholder:text-main-brown/45",
                    invalidFields.postalCode && "border-main-brown/70 bg-main-brown/[0.05] shadow-[0_0_0_3px_rgba(79,44,29,0.08)]"
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-[58px_minmax(0,1fr)] items-start gap-3">
              <label htmlFor="base-address" className="pt-3 text-[13px] font-bold text-main-brown">기본 주소</label>
              <div className="min-w-0">
                <div className="flex min-w-0 gap-2">
                  <input
                    id="base-address"
                    ref={baseAddressRef}
                    type="text"
                    value={formValues.baseAddress}
                    onChange={(event) => {
                      updateBaseAddressField(event.target.value);
                    }}
                    maxLength={100}
                    placeholder="도로명/건물명/지번 검색"
                    aria-invalid={Boolean(invalidFields.baseAddress) || undefined}
                    aria-describedby={addressSearchError ? 'address-search-error' : undefined}
                    className={cn(
                      "h-11 min-w-0 flex-1 rounded-lg border border-main-brown/10 bg-white px-4 text-[13px] font-medium text-main-brown outline-none placeholder:text-main-brown/45 focus:border-main-brown/45",
                      invalidFields.baseAddress && "border-main-brown/70 bg-main-brown/[0.05] shadow-[0_0_0_3px_rgba(79,44,29,0.08)]"
                    )}
                  />
                  <button
                    type="button"
                    onClick={searchAddress}
                    disabled={isAddressSearchLoading}
                    className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-main-brown px-3 text-[12px] font-bold text-white shadow-[0_8px_18px_rgba(79,44,29,0.16)] transition hover:bg-main-brown/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Search size={14} aria-hidden="true" />
                    {isAddressSearchLoading ? '검색 중' : '주소 검색'}
                  </button>
                </div>
                <FieldError id="address-search-error" message={addressSearchError} />
              </div>
            </div>
            {addressSearchMessage && (
              <p className="-mt-1 ml-[70px] text-[11px] font-medium text-main-brown/70" aria-live="polite">
                {addressSearchMessage}
              </p>
            )}

            <div className="grid grid-cols-[58px_minmax(0,1fr)] items-start gap-3">
              <label htmlFor="detail-address" className="pt-3 text-[13px] font-bold text-main-brown">상세 주소</label>
              <div className="min-w-0">
                <input
                  id="detail-address"
                  type="text"
                  value={formValues.detailAddress}
                  onChange={(event) => updateField('detailAddress', event.target.value)}
                  placeholder={ADDRESS_PLACEHOLDERS.detailAddress}
                  ref={detailAddressRef}
                  maxLength={100}
                  autoComplete="address-line2"
                  aria-invalid={Boolean(invalidFields.detailAddress) || undefined}
                  aria-describedby={invalidFields.detailAddress ? 'detail-address-error' : undefined}
                  className={cn(
                    "h-11 w-full min-w-0 rounded-lg border border-main-brown/10 bg-white px-4 text-[13px] font-medium text-main-brown outline-none placeholder:text-main-brown/65 focus:border-main-brown/45",
                    invalidFields.detailAddress && "border-main-brown/70 bg-main-brown/[0.05] shadow-[0_0_0_3px_rgba(79,44,29,0.08)]"
                  )}
                />
                <FieldError id="detail-address-error" message={invalidFields.detailAddress} />
              </div>
            </div>

            <div className="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-3">
              <span id="delivery-memo-label" className="text-[13px] font-bold text-main-brown">배송 메모</span>
              <div className="relative min-w-0">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={deliveryMemoOpen}
                  aria-labelledby="delivery-memo-label delivery-memo-value"
                  onClick={() => setDeliveryMemoOpen((open) => !open)}
                  className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-main-brown/10 bg-white px-4 text-left text-[13px] font-medium text-main-brown outline-none transition focus:border-main-brown/45"
                >
                  <span id="delivery-memo-value" className="min-w-0 truncate">{formValues.deliveryMemo}</span>
                  <ChevronDown size={17} className="shrink-0 text-main-brown" aria-hidden="true" />
                </button>
                {deliveryMemoOpen && (
                  <div
                    role="listbox"
                    aria-labelledby="delivery-memo-label"
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-main-brown/10 bg-white py-1 shadow-[0_12px_24px_rgba(79,44,29,0.13)]"
                  >
                    {DELIVERY_MEMO_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={formValues.deliveryMemo === option}
                        onClick={() => {
                          updateField('deliveryMemo', option);
                          setDeliveryMemoOpen(false);
                        }}
                        className="flex h-10 w-full items-center px-4 text-left text-[13px] font-medium text-main-brown transition hover:bg-main-brown/[0.05]"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-4">
            <div
              className={cn(
                "flex items-start gap-3 rounded-[14px] border px-4 py-3",
                statusHasAlert
                  ? "border-main-brown/25 bg-main-brown/[0.07]"
                  : "border-main-brown/10 bg-main-brown/[0.04]"
              )}
            >
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-main-brown text-white">
                <Info size={14} aria-hidden="true" />
              </div>
              <p className="text-[12px] leading-relaxed text-sub-gray" aria-live="polite">
                {statusMessage}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-full rounded-[14px]">
                {isSubmitting ? '주문 저장 중' : '주문 완료'}
              </button>
              <button type="button" onClick={onPrevious} disabled={isSubmitting} className="btn btn-secondary btn-full rounded-[14px]">
                이전 단계
              </button>
            </div>
          </div>
        </form>
      </div>

      <AnimatePresence>
        {orderCompleteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25 px-7"
            onClick={() => setOrderCompleteOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-complete-heading"
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-[320px] rounded-[22px] border border-main-brown/10 bg-white p-6 text-center shadow-[0_18px_42px_rgba(79,44,29,0.16)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-main-brown text-white">
                <CheckCircle2 size={25} aria-hidden="true" />
              </div>
              <h3 id="order-complete-heading" className="mt-4 text-[20px] font-bold text-main-brown">주문이 완료되었습니다</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-sub-gray">
                입력하신 배송지로 추천 눈썹 디자인 주문 정보가 접수되었습니다.
              </p>
              <button
                type="button"
                onClick={() => setOrderCompleteOpen(false)}
                className="btn btn-primary btn-full mt-6 rounded-[14px]"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
