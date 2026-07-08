import TRCA_Logo from "../../../public/RTC_Aurora_Logo.png"

export default function TestPage() {
    return (
        <center style={{ lineHeight: "1.2", marginTop: 5 }}>
            <img src={TRCA_Logo} alt="RTCA Logo" style={{ width: 70, marginBottom: "4px" }} />
            <div>Philippine Coast Guard</div>
            <div>Coast Guard Education, Training and Doctrine Command</div>
            <strong>REGIONAL TRAINING CENTER AURORA</strong>
            <div>Brgy. Mijares, Dipaculao, Aurora</div>
        </center>
    )
}