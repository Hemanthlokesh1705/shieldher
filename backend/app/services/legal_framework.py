"""
ShieldHer – Verified Legal Knowledge Base & Reporting Guidance.

STATUTORY SOURCES:
- Information Technology Act, 2000 (India Code: https://www.indiacode.nic.in/handle/123456789/1999)
- Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (MeitY: https://www.meity.gov.in/)
- Bhartiya Nyaya Sanhita, 2023 (Commenced July 1, 2024: https://www.indiacode.nic.in/handle/123456789/22375)
- National Cyber Crime Reporting Portal (MHA: https://cybercrime.gov.in/)

CRITICAL MANDATES:
1. Citations are conditionally matched based on user-reported facts.
2. Incidents on or after July 1, 2024 fall under BNS 2023; prior offenses under IPC 1860.
3. Does not assume every incident falls under every law; provides factual criteria.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from app.schemas.complaint import ApplicableLegalProvision


class LegalFrameworkService:
    """Provides verified statutory provisions and procedural reporting workflows."""

    @staticmethod
    def get_applicable_provisions(
        has_intimate_depiction: bool = True,
        is_synthetic_or_deepfake: bool = False,
        has_extortion_or_threats: bool = False,
        incident_date_is_post_july_2024: bool = True,
    ) -> List[ApplicableLegalProvision]:
        """
        Conditionally determines potentially applicable legal provisions based on reported facts.
        """
        provisions: List[ApplicableLegalProvision] = []

        # 1. Section 66E IT Act, 2000 (Violation of Privacy)
        if has_intimate_depiction:
            provisions.append(
                ApplicableLegalProvision(
                    statute="Information Technology Act, 2000",
                    section_or_rule="Section 66E",
                    title="Punishment for Violation of Privacy",
                    commencement_date="2009-10-27 (via IT Amendment Act, 2008)",
                    relevance_and_conditions=(
                        "Applies where an individual intentionally or knowingly captures, publishes, "
                        "or transmits the image of a private area of any person without consent, "
                        "under circumstances violating privacy."
                    ),
                    statutory_deadline=None,
                    official_source_url="https://www.indiacode.nic.in/handle/123456789/1999",
                )
            )

        # 2. Section 67A IT Act, 2000 (Sexually Explicit Material)
        if has_intimate_depiction:
            provisions.append(
                ApplicableLegalProvision(
                    statute="Information Technology Act, 2000",
                    section_or_rule="Section 67A",
                    title="Punishment for Publishing or Transmitting Material Containing Sexually Explicit Acts",
                    commencement_date="2009-10-27 (via IT Amendment Act, 2008)",
                    relevance_and_conditions=(
                        "Applies where electronic material depicts sexually explicit acts. "
                        "Carries enhanced penalties for first and subsequent convictions."
                    ),
                    statutory_deadline=None,
                    official_source_url="https://www.indiacode.nic.in/handle/123456789/1999",
                )
            )

        # 3. Rule 3(2)(b) IT Rules, 2021 (Mandatory 24-Hour Intermediary Takedown)
        provisions.append(
            ApplicableLegalProvision(
                statute="Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021",
                section_or_rule="Rule 3(2)(b)",
                title="Intermediary Due Diligence — Mandatory 24-Hour Content Takedown",
                commencement_date="2021-02-25",
                relevance_and_conditions=(
                    "Legally obligates intermediaries (social media platforms, hosting providers, messaging services) "
                    "to remove or disable access to content exposing the private area of an individual, showing sexual "
                    "acts or conduct, or non-consensual depiction within 24 hours of receiving a complaint from the "
                    "victim or authorized representative."
                ),
                statutory_deadline="Strictly within 24 hours of receipt of notice",
                official_source_url="https://www.meity.gov.in/writereaddata/files/Intermediary_Guidelines_and_Digital_Media_Ethics_Code_Rules-2021.pdf",
            )
        )

        # 4. Voyeurism: BNS Section 77 (post July 2024) vs IPC Section 354C (pre July 2024)
        if has_intimate_depiction:
            if incident_date_is_post_july_2024:
                provisions.append(
                    ApplicableLegalProvision(
                        statute="Bhartiya Nyaya Sanhita, 2023 (BNS)",
                        section_or_rule="Section 77",
                        title="Voyeurism (Capturing or Disseminating Private Images of a Woman)",
                        commencement_date="2024-07-01",
                        relevance_and_conditions=(
                            "Governs offenses occurring on or after July 1, 2024. Penalizes capturing or disseminating "
                            "images of a woman in circumstances where she had a reasonable expectation of privacy."
                        ),
                        statutory_deadline=None,
                        official_source_url="https://www.indiacode.nic.in/handle/123456789/22375",
                    )
                )
            else:
                provisions.append(
                    ApplicableLegalProvision(
                        statute="Indian Penal Code, 1860 (IPC)",
                        section_or_rule="Section 354C",
                        title="Voyeurism",
                        commencement_date="2013-02-03 (Criminal Law Amendment Act, 2013)",
                        relevance_and_conditions="Applicable to offenses committed prior to July 1, 2024.",
                        statutory_deadline=None,
                        official_source_url="https://www.indiacode.nic.in/handle/123456789/2263",
                    )
                )

        # 5. Deepfakes & Impersonation: BNS Section 318 / Section 66D IT Act
        if is_synthetic_or_deepfake:
            provisions.append(
                ApplicableLegalProvision(
                    statute="Information Technology Act, 2000",
                    section_or_rule="Section 66D",
                    title="Punishment for Cheating by Personation by Using Computer Resource",
                    commencement_date="2009-10-27",
                    relevance_and_conditions=(
                        "Applies where AI-generated synthetic media, face swaps, or voice morphing are used "
                        "to impersonate the victim to commit fraud, cause reputational damage, or mislead others."
                    ),
                    statutory_deadline=None,
                    official_source_url="https://www.indiacode.nic.in/handle/123456789/1999",
                )
            )

        # 6. Extortion & Threats: BNS Section 351 (Criminal Intimidation) / Section 308 (Extortion)
        if has_extortion_or_threats:
            provisions.append(
                ApplicableLegalProvision(
                    statute="Bhartiya Nyaya Sanhita, 2023 (BNS)",
                    section_or_rule="Section 351 & Section 308",
                    title="Criminal Intimidation & Extortion via Threat of Dissemination",
                    commencement_date="2024-07-01",
                    relevance_and_conditions=(
                        "Applies where the perpetrator threatens to circulate private imagery to extort money, "
                        "coerce actions, or inflict grave injury to reputation or physical safety."
                    ),
                    statutory_deadline=None,
                    official_source_url="https://www.indiacode.nic.in/handle/123456789/22375",
                )
            )

        return provisions

    @staticmethod
    def get_official_reporting_guidelines() -> Dict[str, Any]:
        """Official reporting avenues, portals, and emergency hotlines in India."""
        return {
            "national_cyber_crime_portal": {
                "name": "National Cyber Crime Reporting Portal",
                "portal_url": "https://cybercrime.gov.in",
                "designated_category": "Report Crime Related to Women / Child",
                "anonymous_reporting_option": True,
                "notes": (
                    "Victims may file a formal registered complaint or select 'Report Anonymously'. "
                    "When filing, select category: 'Sexually Explicit Material' or 'Publishing/Transmitting Obscene Material'. "
                    "Upload the generated complaint draft and forensic hash index as supporting documentation."
                ),
            },
            "national_cyber_helpline": {
                "number": "1930",
                "description": "National Cybercrime Helpline (Ministry of Home Affairs, Govt. of India)",
                "availability": "24x7 Toll-Free",
            },
            "women_helpline": {
                "number": "112",
                "description": "National Emergency Response Support System (ERSS)",
                "national_commission_for_women_helpline": "7827170170",
            },
            "platform_intermediary_takedown": {
                "rule_citation": "Rule 3(2)(b) of IT Rules, 2021",
                "takedown_timeframe": "24 hours mandatory",
                "procedure": (
                    "Submit the generated 24-Hour Intermediary Takedown Notice directly to the platform's "
                    "designated Grievance Officer in India (email or web form). Intermediaries are legally "
                    "bound to disable access within 24 hours of notification."
                ),
            },
            "stop_ncii_initiative": {
                "portal_url": "https://stopncii.org",
                "description": (
                    "Victim-operated perceptual hash creation tool. Operates entirely in-browser on the "
                    "victim's device without uploading the raw image. Hashes are shared with participating "
                    "platforms (Meta, TikTok, OnlyFans, etc.) to detect and prevent upload."
                ),
            },
        }


_legal_framework_service: LegalFrameworkService | None = None


def get_legal_framework_service() -> LegalFrameworkService:
    global _legal_framework_service
    if _legal_framework_service is None:
        _legal_framework_service = LegalFrameworkService()
    return _legal_framework_service
