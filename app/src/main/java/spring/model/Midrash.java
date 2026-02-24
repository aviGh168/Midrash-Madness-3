package spring.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Model representing a single Midrash from the midrash_list table.
 */
public class Midrash {

    @JsonProperty("midrash_id")
    private int midrashId;

    @JsonProperty("group")
    private String group;

    @JsonProperty("seed")
    private int seed;

    @JsonProperty("short_desc")
    private String shortDesc;

    @JsonProperty("long_desc")
    private String longDesc;

    @JsonProperty("source")
    private String source;

    public int getMidrashId() { return midrashId; }
    public void setMidrashId(int midrashId) { this.midrashId = midrashId; }

    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public int getSeed() { return seed; }
    public void setSeed(int seed) { this.seed = seed; }

    public String getShortDesc() { return shortDesc; }
    public void setShortDesc(String shortDesc) { this.shortDesc = shortDesc; }

    public String getLongDesc() { return longDesc; }
    public void setLongDesc(String longDesc) { this.longDesc = longDesc; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
}