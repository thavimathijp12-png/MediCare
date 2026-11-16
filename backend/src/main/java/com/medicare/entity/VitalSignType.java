package com.medicare.entity;

public enum VitalSignType {
    TEMPERATURE_C("°C"),
    HEART_RATE_BPM("bpm"),
    RESPIRATORY_RATE_PER_MIN("breaths/min"),
    SYSTOLIC_BP_MMHG("mmHg"),
    DIASTOLIC_BP_MMHG("mmHg"),
    OXYGEN_SATURATION_PERCENT("%"),
    WEIGHT_KG("kg"),
    HEIGHT_CM("cm");

    private final String unit;

    VitalSignType(String unit) {
        this.unit = unit;
    }

    public String getUnit() {
        return unit;
    }
}
